import hashlib
import json
import random
import string
import time
import urllib.error
import urllib.request

from models import User, Session
from SimpleWebSocketServer import SimpleWebSocketServer
from wson import WSON

MOTTO_LEN = 8


def rnd_gen(size=8, chars=string.ascii_lowercase + string.digits):
    return ''.join(random.choice(chars) for _ in range(size))


def get_god_info(name):
    try:
        raw = urllib.request.urlopen("http://godville.net/gods/api/" + name + ".json").read()
    except urllib.error.HTTPError:
        return False
    return json.loads(raw.decode("utf-8"))


clients = []
users = []
jump_time = 0
jump_delay = 300  # = (5 minutes) * 60


class ActiveUser:

    def __init__(self, name):
        self.name = name
        self.ready = False


class GVD(WSON):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.auth_name = ""
        self.auth_salt = ""
        self.auth_sid = ""

        self.user = None

        self.on("sign", self.signup_ph1)
        self.on("login", self.auth_ph1)
        self.on("sid", self.continue_session)
        self.on("test_auth", lambda: self.sendMessage(self.auth_name + ": " + str(self.user is not None)))

    def handleConnected(self):
        print(self.address, 'connected')
        clients.append(self)

    def handleClose(self):
        print(self.address, 'closed')
        self.logout()
        clients.remove(self)

    def create_session(self):
        self.auth_salt = ""
        sid = rnd_gen(32)

        s = Session.create(sid=sid, god=self.auth_name)
        s.save()

        self.authorize()
        self.send("auth", {"status": "success", "sid": sid})

    def authorize(self):
        for u in users:
            if u.name == self.auth_name:
                self.user = u
        if not self.user:
            u = ActiveUser(self.auth_name)
            users.append(u)
            self.user = u

        self.on("load", self.load_data)
        self.on("jump", self.jump)
        self.on("logout", self.close_session)

    def logout(self):
        self.user = None
        # TODO: remove activeuser if all its clients have disconnected
        self.off("load")
        self.off("jump")

    # SIGN UP ##########

    def signup_ph1(self, data):
        god_info = get_god_info(data["login"])
        if not god_info:
            self.send_error("Unknown god name")
            return
        self.auth_name = god_info['godname']

        user, created = User.get_or_create(god_name=self.auth_name)
        if created or user.motto_login == "":
            motto = rnd_gen(MOTTO_LEN)
            user.motto_login = motto
        else:
            motto = user.motto_login
        user.save()

        self.on("motto", self.signup_ph2)
        self.send("sign", {"motto": motto})

    def signup_ph2(self, _):
        user = User.get(god_name=self.auth_name)
        req_motto = user.motto_login

        god_info = get_god_info(self.auth_name)
        if not god_info:
            self.send_error("Unknown god name")
            return
        motto = god_info['motto']

        if motto.find(req_motto) == -1:
            self.send("motto", {"status": "declined"})
        else:
            self.off("motto")
            self.on("passwd", self.passwd)
            self.send("motto", {"status": "accepted"})

    def passwd(self, data):
        password = data["password"]
        user = User.get(god_name=self.auth_name)
        user.password = hashlib.sha1(password.encode()).hexdigest()
        user.motto_login = ""
        user.save()

        self.off("passwd")
        self.send("success", {})

    # AUTH ##########

    def auth_ph1(self, data):
        self.auth_name = data["login"]

        try:
            User.get(god_name=self.auth_name)
        except User.DoesNotExist:
            self.send_error("User does not registered")
            return

        # TODO: Fake unregistered user to provide more security

        self.auth_salt = rnd_gen(32)
        self.on("auth", self.auth_ph2)
        self.send("salt", {"salt": self.auth_salt})

    def auth_ph2(self, data):
        if len(self.auth_salt) < 32:
            return

        user = User.get(god_name=self.auth_name)
        req = hashlib.sha1((user.password + self.auth_salt).encode()).hexdigest()

        if not data["password"] == req:
            self.send("auth", {"status": "fail"})
            return

        self.off("auth")
        self.create_session()

    def continue_session(self, data):
        try:
            s = Session.get(sid=data["sid"])
        except Session.DoesNotExist:
            self.send("sid", {"status": "declined"})
            return

        self.auth_name = s.god.god_name
        self.authorize()
        self.send("sid", {"status": "accepted"})

    def close_session(self):
        s = Session.get(sid=self.auth_sid)
        s.delete_instance()
        self.logout()

    # WORK ##########

    def load_data(self, _):
        gods = list(set([c.user.name for c in clients]))
        jump_info = {"active": (jump_time - int(time.time())) > 0}
        if jump_info["active"]:
            jump_info["delay"] = jump_time - int(time.time())
            jump_info["ready"] = list(set([c.user.name for c in clients if c.user.ready]))
        self.send("data", {"users": gods, "jump": jump_info})

    def jump(self, _):
        global jump_time

        if int(time.time()) < jump_time:  # join
            if not self.user.ready:
                for c in clients:
                    c.send("ready", {
                        "user": self.user.name
                    })
            self.user.ready = True
        else:  # start new
            jump_time = int(time.time()) + jump_delay

            for c in clients:
                c.user.ready = False
                c.send("jump", {
                    "delay": jump_time - int(time.time()),
                    "user": self.user.name
                })
            self.user.ready = True


server = SimpleWebSocketServer('', 8765, GVD)
server.serveforever()
