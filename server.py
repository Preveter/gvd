import json
import random
import string
import urllib.error
import urllib.request
import hashlib

import peewee

from SimpleWebSocketServer import SimpleWebSocketServer, WebSocket

clients = []
db = peewee.SqliteDatabase("gvd.db")
db.connect()

MOTTO_LEN = 8


def rnd_gen(size=8, chars=string.ascii_lowercase + string.digits):
    return ''.join(random.choice(chars) for _ in range(size))


def get_god_info(name):
    try:
        raw = urllib.request.urlopen("http://godville.net/gods/api/" + name + ".json").read()
    except urllib.error.HTTPError:
        return False
    return json.loads(raw.decode("utf-8"))


class User(peewee.Model):
    god_name = peewee.FixedCharField(index=True, primary_key=True, max_length=30)
    password = peewee.CharField(null=True, max_length=255)
    motto_login = peewee.CharField(null=True, max_length=30)

    class Meta:
        database = db


class Session(peewee.Model):
    sid = peewee.FixedCharField(index=True, primary_key=True, max_length=32)
    god = peewee.ForeignKeyField(User, related_name='sessions')
    last_connect = peewee.DateTimeField(null=True)
    last_address = peewee.CharField(null=True, max_length=255)

    class Meta:
        database = db


# db.create_table(User)
# db.create_table(Session)


class GVD(WebSocket):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.name = ""
        self.authorized = False
        self.auth_salt = ""

        self.user = False

        self.handlers = {}

        self.on("sign", self.signup_ph1)
        self.on("login", self.auth_ph1)
        self.on("sid", self.session)
        self.on("test_auth", lambda: self.sendMessage(self.name + ": " + str(self.authorized)))

    def handleConnected(self):
        print(self.address, 'connected')
        clients.append(self)

    def handleClose(self):
        print(self.address, 'closed')
        clients.remove(self)

    def handleMessage(self):
        data = self.data
        print("< " + data)
        msg_arr = json.loads(data)
        names = msg_arr.keys()

        for name in names:
            if name in self.handlers:
                self.handlers[name](msg_arr[name])

    def on(self, msg, handler):
        self.handlers[msg] = handler

    def off(self, msg):
        del self.handlers[msg]

    def send(self, msg, data):
        line = json.dumps({msg: data})
        print("> " + line)
        self.sendMessage(line)

    def send_error(self, err_msg):
        self.send("error", {"msg": err_msg})

    def authorize(self):
        self.authorized = True
        self.auth_salt = ""
        sid = rnd_gen(32)

        s = Session.create(sid=sid, god=self.name)
        s.save()

        self.send("auth", {"status": "success", "sid": sid})

    # SIGN UP ##########

    def signup_ph1(self, data):
        god_info = get_god_info(data["login"])
        if not god_info:
            self.send_error("Unknown god name")
            return
        self.name = god_info['godname']

        user, created = User.get_or_create(god_name=self.name)
        if created or user.motto_login == "":
            motto = rnd_gen(MOTTO_LEN)
            user.motto_login = motto
        else:
            motto = user.motto_login
        user.save()

        self.on("motto", self.signup_ph2)
        self.send("sign", {"motto": motto})

    def signup_ph2(self, _):
        user = User.get(god_name=self.name)
        req_motto = user.motto_login

        god_info = get_god_info(self.name)
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
        user = User.get(god_name=self.name)
        user.password = hashlib.sha1(password.encode()).hexdigest()
        user.motto_login = ""
        user.save()

        self.off("passwd")
        self.send("success", {})

    # AUTH ##########

    def auth_ph1(self, data):
        self.name = data["login"]

        try:
            User.get(god_name=self.name)
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

        user = User.get(god_name=self.name)
        req = hashlib.sha1((user.password + self.auth_salt).encode()).hexdigest()

        if not data["password"] == req:
            self.send("auth", {"status": "fail"})
            return

        self.off("auth")
        self.authorize()

    def session(self, sid):
        try:
            s = Session.get(sid=sid)
        except Session.DoesNotExist:
            self.sendMessage("Wrong SID!")
            return

        self.name = s.god.god_name
        self.authorized = True
        self.sendMessage("success")


server = SimpleWebSocketServer('', 8765, GVD)
server.serveforever()
