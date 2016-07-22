#!/usr/bin/python3
import hashlib
import json
import os
import random
import string
import time
import urllib.error
import urllib.parse
import urllib.request

from tornado import web, ioloop, gen
from wson import WSON

from models import User, Session

MOTTO_LEN = 8
SALT_LEN = 32
JUMP_DELAY = 60  # = (1 minute) * 60

WEB_PATH = os.path.join(os.path.dirname(__file__), "..", "web")


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
        self.online = True
        self.clients = []


class Jump:
    def __init__(self, initiator, delay=JUMP_DELAY):
        self.time = int(time.time()) + delay
        self.users = [initiator]
        self.initiator = initiator

    def add_user(self, user):
        self.users.append(user)


class GVD:
    def __init__(self):
        self.clients = []
        self.jumps = []
        self.users = []

    def add_client(self, cl):
        """
        Add websocket handler to client list
        :param cl: Tornado websocket handler to add
        """
        self.clients.append(cl)

    def remove_client(self, cl):
        """
        Remove client from list
        :param cl: Tornado websocket handler to remove
        """
        self.clients.remove(cl)
        for u in self.users:
            if cl in u.clients:
                u.clients.remove(cl)
            if len(u.clients) == 0:
                self.broadcast("user", {"name": u.name, "status": "off"})  # TODO: Think what to do with it

    def broadcast(self, msg, data):  # TODO: Think, do i really need it here
        """
        Send message to all clients
        :param msg:
        :param data:
        """
        print(">>> BROADCASTING >>>")
        for c in self.clients:
            c.send(msg, data)
        print(">>> END >>>")

    def get_user_by_name(self, name):
        """
        Find user object by username
        :param name: Username
        :return: User object or None if user doesn't exist
        :rtype: ActiveUser
        """
        for u in self.users:
            if u.name == name:
                return u
        return None

    def get_client_user(self, client):
        """
        Get user object bound with given client
        :param client: Tornado websocket handler
        :return: User object for given client
        :rtype: ActiveUser
        """
        for u in self.users:
            if client in u.clients:
                return u
        return None

    def login(self, client, name):
        """
        Authenticate client as registered user
        :param client: Tornado websocket handler
        :param name: Username
        """
        user = self.get_user_by_name(name)
        if user is None:
            user = ActiveUser(name)
            self.users.append(user)
        self.set_client_user(client, user)

    def logout(self, client):
        """
        Deauthenticate user
        :param client: Tornado websocket handler
        """
        self.set_client_user(client, None)

    def set_client_user(self, client, new_user):
        """
        Bind client to user object
        :param client: Tornado websocket handler
        :param new_user: User object or None
        """
        old_user = self.get_client_user(client)

        if not (new_user is None or old_user is None):  # If one of the users is None, no need to check equality
            if new_user == old_user:  # Check equality to prevent rapid off-on blinking
                return

        if old_user is not None:
            old_user.clients.remove(client)
            if len(old_user.clients) == 0:
                old_user.online = False
                self.broadcast("user", {"name": old_user.name, "status": "off"})  # TODO: Think what to do with it

        if new_user is not None:
            if len(new_user.clients) == 0:
                new_user.online = True
                self.broadcast("user", {"name": new_user.name, "status": "on"})  # TODO: Think what to do with it
            new_user.clients.append(client)

    def get_jump_by_member(self, user):
        """
        :param user:
        :return: Jump object or None if jump with given member doesn't exist
        :rtype: Jump
        """
        for j in self.jumps:
            if user in j.users:
                return j
        return None

    def get_gods_list(self):
        info = []
        for user in self.users:
            info.append({
                "name": user.name,
                "online": user.online,
            })
        return info

    def get_jumps_info(self):
        info = []
        for jump in self.jumps:
            names = []
            for user in jump.users:
                names.append(user.name)
            info.append({
                "delay": jump.time - int(time.time()),
                "members": names,
                "initiator": jump.initiator.name,
            })
        return info

    @gen.coroutine
    def init_jump(self, initiator):
        user = self.get_client_user(initiator)
        if (user is None) or (self.get_jump_by_member(user) is not None):
            initiator.send_error_msg("You can't create group now")
            return

        jump = Jump(user)
        self.jumps.append(jump)
        self.broadcast("jump", {
            "delay": jump.time - int(time.time()),
            "user": user.name
        })

        yield gen.sleep(jump.time - int(time.time()))
        self.jumps.remove(jump)

    def join_jump(self, client, member_name):
        user = self.get_client_user(client)
        if (user is None) or (self.get_jump_by_member(user) is not None):
            client.send_error_msg("You can't join group now")
            return

        member = self.get_user_by_name(member_name)
        jump = self.get_jump_by_member(member)
        if jump is None:
            client.send_error_msg("Group you are trying to join does not exist")
            return

        jump.add_user(user)
        self.broadcast("join", {"user": user.name, "member": member.name})


class SocketHandler(WSON):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.auth_name = ""
        self.auth_salt = ""
        self.auth_sid = ""

        self.auth_status = False

        self.on("salt", self.get_salt)
        self.on("auth", self.auth)

        self.on("sign", self.signup_start)
        self.on("motto", self.signup_test)

        self.on("sid", self.continue_session)

        self.on("data", self.load_data)
        self.on("jump", self.jump)
        self.on("join", self.join)
        self.on("logout", self.close_session)

    def open(self):
        print(self.request.remote_ip, 'connected')
        self.gvd.add_client(self)

    def on_close(self):
        print(self.request.remote_ip, 'closed')
        self.gvd.remove_client(self)

    # SIGN UP ##########

    def signup_start(self, data):
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

        self.send("sign", {"motto": motto})

    def signup_test(self, _):
        user = User.get(god_name=self.auth_name)

        if user.motto_login is None or len(user.motto_login) < MOTTO_LEN:
            self.send_error_msg("Sign up sequence violation")
            return

        req_motto = user.motto_login

        god_info = get_god_info(self.auth_name)
        if not god_info:
            self.send_error_msg("Unknown god name. SURPRISE!")
            return
        motto = god_info['motto']

        if motto.find(req_motto) == -1:
            self.send("motto", {"status": "declined"})
        else:
            self.on("password", self.signup_password)
            self.send("motto", {"status": "accepted"})

    def signup_password(self, data):
        password = data["password"]
        user = User.get(god_name=self.auth_name)
        user.password = hashlib.sha1(password.encode()).hexdigest()
        user.motto_login = ""
        user.save()

        self.off("password")
        self.send("password", {"status": "changed"})

    # AUTHENTICATION #####

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

        self.gvd.login(self, name)
        self.auth_status = True

        self.send("auth", {"status": "success", "sid": self.auth_sid})

    def continue_session(self, data):
        try:
            s = Session.get(sid=data["sid"])
        except Session.DoesNotExist:
            self.send("sid", {"status": "declined"})
            return

        self.auth_sid = s.sid
        self.gvd.login(self, s.god.god_name)

        self.auth_status = True

        self.send("sid", {"status": "accepted"})

    # WORK ##########

    def close_session(self, _):
        try:
            s = Session.get(sid=self.auth_sid)
            s.delete_instance()
        except Session.DoesNotExist:
            pass
        self.send("logout", {})
        self.gvd.logout(self)
        self.auth_status = False

    def load_data(self, _):
        if not self.auth_status:
            self.send_error_msg("Unauthorized")
            return

        gods = self.gvd.get_gods_list()
        jumps = self.gvd.get_jumps_info()

        me = self.gvd.get_client_user(self)

        self.send("data", {
            "users": gods,
            "jumps": jumps,
            "me": {
                "name": me.name
            },
        })

    def jump(self, _):
        if not self.auth_status:
            self.send_error_msg("Unauthorized")
            return

        self.gvd.init_jump(self)

    def join(self, data):
        if not self.auth_status:
            self.send_error_msg("Unauthorized")
            return

        name = data["member"]
        self.gvd.join_jump(self, name)


def sh_factory(gvd):
    class SocketHandlerEnhanced(SocketHandler):
        def __init__(self, *args, **kwargs):
            super(SocketHandlerEnhanced, self).__init__(*args, **kwargs)
            self.gvd = gvd
    return SocketHandlerEnhanced


class Page(web.RequestHandler):
    def get(self):
        self.render(os.path.join(WEB_PATH, "index.html"))


if __name__ == '__main__':
    print(os.path.join(WEB_PATH, "static"))
    settings = {
        "static_path": os.path.join(WEB_PATH, "static"),
        "debug": True,
    }
    app = web.Application([
        (r"/", Page),
        (r'/ws', sh_factory(GVD())),
        (r"/static/(.*)", web.StaticFileHandler, dict(path=settings['static_path'])),
    ])
    app.listen(8083)
    ioloop.IOLoop.instance().start()
