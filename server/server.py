import hashlib
import json
import random
import string
import time
import os
import urllib.error
import urllib.parse
import urllib.request

from models import User, Session
from wson import WSON

from tornado import web, ioloop

MOTTO_LEN = 8
SALT_LEN = 32
JUMP_DELAY = 300  # = (5 minutes) * 60


def rnd_gen(size=8, chars=string.ascii_lowercase + string.digits):
    return ''.join(random.choice(chars) for _ in range(size))


def get_god_info(name):
    try:
        raw = urllib.request.urlopen("http://godville.net/gods/api/" + urllib.parse.quote(name) + ".json").read()
    except urllib.error.HTTPError:
        return False
    return json.loads(raw.decode("utf-8"))


class ActiveUser:
    def __init__(self, name):
        self.name = name
        self.ready = False
        self.clients = []


class GVD:
    def __init__(self):
        self.clients = []
        self.jump_time = 0

    def add_client(self, cl):
        self.clients.append(cl)

    def remove_client(self, cl):
        self.clients.remove(cl)

    def broadcast(self, msg, data):
        print(">>> BROADCASTING >>>")
        for c in self.clients:
            c.send(msg, data)
        print(">>> END >>>")

    def get_user_by_name(self, name):
        for c in self.clients:
            if c.user and c.user.name == name:
                return c.user
        return None

    def get_gods_list(self):
        return list(set([c.user.name for c in self.clients if c.user]))

    def get_jump_info(self):
        jump = {"active": (self.jump_time - int(time.time())) > 0}
        if jump["active"]:
            jump["delay"] = self.jump_time - int(time.time())
            jump["ready"] = list(set([c.user.name for c in self.clients if c.user and c.user.ready]))
        return jump

    def init_jump(self, initiator):
        user = initiator.user

        if int(time.time()) < self.jump_time:
            # join existing jump
            if not user.ready:
                self.broadcast("ready", {"user": user.name})
                user.ready = True
        else:
            # initiate new jump
            jump_time = int(time.time()) + JUMP_DELAY

            for c in self.clients:
                c.user.ready = False
                c.send("jump", {
                    "delay": jump_time - int(time.time()),
                    "user": user.name
                })
                user.ready = True


class SocketHandler(WSON):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.auth_name = ""
        self.auth_salt = ""
        self.auth_sid = ""

        self.user = None

        self.on("sign", self.signup_ph1)
        self.on("salt", self.get_salt)
        self.on("auth", self.auth)
        self.on("sid", self.continue_session)
        self.on("test_auth", lambda: self.sendMessage(self.auth_name + ": " + str(self.user is not None)))

    def open(self):
        print(self.request.remote_ip, 'connected')
        self.gvd.add_client(cl=self)

    def on_close(self):
        print(self.request.remote_ip, 'closed')
        self.gvd.remove_client(self)
        self.set_user(None)

    def set_user(self, new_user):
        old_user = self.user

        if new_user == old_user:
            return

        self.user = new_user

        if old_user is not None:
            old_user.clients.remove(self)
            if len(old_user.clients) == 0:
                self.gvd.broadcast("user", {"name": old_user.name, "status": "off"})

        if new_user is not None:
            if len(new_user.clients) == 0:
                self.gvd.broadcast("user", {"name": new_user.name, "status": "on"})
            self.user.clients.append(self)

    def authorize(self, name):
        user = self.gvd.get_user_by_name(name)
        if user is None:
            self.set_user(ActiveUser(name))
        else:
            self.set_user(user)

        self.on("data", self.load_data)
        self.on("jump", self.jump)
        self.on("logout", self.close_session)

    # SIGN UP ##########

    def signup_ph1(self, data):
        god_info = get_god_info(data["login"])
        if not god_info:
            self.send_error_msg("Unknown god name")
            return
        self.auth_name = god_info['godname']

        user, created = User.get_or_create(god_name=self.auth_name)
        if created or user.motto_login is None or len(user.motto_login) < MOTTO_LEN:
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
            self.send_error_msg("Unknown god name")
            return
        motto = god_info['motto']

        if motto.find(req_motto) == -1:
            self.send("motto", {"status": "declined"})
        else:
            self.off("motto")
            self.on("password", self.signup_ph3)
            self.send("motto", {"status": "accepted"})

    def signup_ph3(self, data):
        password = data["password"]
        user = User.get(god_name=self.auth_name)
        user.password = hashlib.sha1(password.encode()).hexdigest()
        user.motto_login = ""
        user.save()

        self.off("password")
        self.send("password", {"status": "changed"})

    # AUTH ##########

    def get_salt(self, _):
        if len(self.auth_salt) < SALT_LEN:
            self.auth_salt = rnd_gen(SALT_LEN)
        self.send("salt", {"salt": self.auth_salt})

    def auth(self, data):
        if len(self.auth_salt) < SALT_LEN:
            return

        name = data["login"]

        try:
            user = User.get(god_name=name)
        except User.DoesNotExist:
            self.send("auth", {"status": "fail"})
            return

        req = hashlib.sha1((user.password + self.auth_salt).encode()).hexdigest()

        if not data["password"] == req:
            self.send("auth", {"status": "fail"})
            return

        self.auth_salt = ""
        self.auth_sid = rnd_gen(32)

        s = Session.create(sid=self.auth_sid, god=name)
        s.save()

        self.authorize(name)
        self.send("auth", {"status": "success", "sid": self.auth_sid})

    def continue_session(self, data):
        try:
            s = Session.get(sid=data["sid"])
        except Session.DoesNotExist:
            self.send("sid", {"status": "declined"})
            return

        self.auth_sid = s.sid
        self.authorize(s.god.god_name)
        self.send("sid", {"status": "accepted"})

    def close_session(self, _):
        try:
            s = Session.get(sid=self.auth_sid)
            s.delete_instance()
        except Session.DoesNotExist:
            pass
        self.send("logout", {})
        self.set_user(None)
        self.off("data")
        self.off("jump")
        self.off("logout")

    # WORK ##########

    def load_data(self, _):
        gods = self.gvd.get_gods_list()
        jump = self.gvd.get_jump_info()
        me = {
            "name": self.user.name,
            "ready": self.user.ready
        }
        self.send("data", {"users": gods, "me": me, "jump": jump})

    def jump(self, _):
        self.gvd.init_jump(self)


def sh_factory(gvd):
    class SocketHandlerEnhanced(SocketHandler):
        def __init__(self, *args, **kwargs):
            super(SocketHandlerEnhanced, self).__init__(*args, **kwargs)
            self.gvd = gvd
            print("self.gvd: ", self.gvd)
    return SocketHandlerEnhanced


class Page(web.RequestHandler):
    def get(self):
        self.render("index.html")


if __name__ == '__main__':
    settings = {
        "static_path": os.path.join(os.path.dirname(__file__), "static"),
        "debug": True,
    }
    app = web.Application([
        (r"/", Page),
        (r'/ws', sh_factory(GVD())),
        (r"/static/(.*)", web.StaticFileHandler, dict(path=settings['static_path'])),
    ])
    app.listen(8083)
    ioloop.IOLoop.instance().start()
