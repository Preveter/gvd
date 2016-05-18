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
        self.password_change = False

        self.user = False

    def handleConnected(self):
        print(self.address, 'connected')
        clients.append(self)

    def handleClose(self):
        print(self.address, 'closed')
        clients.remove(self)

    def handleMessage(self):
        raw = self.data.split(" ", 1)
        com = raw[0]
        try:
            data = raw[1].split(" ")
        except IndexError:
            data = []

        if com == "sign":
            self.sign_ph1(data[0])
        if com == "motto":
            self.sign_ph2()
        if com == "passwd":
            self.passwd(data[0])
        if com == "login":
            self.auth_ph1(data[0])
        if com == "auth":
            self.auth_ph2(data[0])
        if com == "sid":
            self.session(data[0])
        if com == "testauth":
            self.sendMessage(self.name + ": " + str(self.authorized))

    def authorize(self):
        self.authorized = True
        self.auth_salt = ""
        sid = rnd_gen(32)

        s = Session.create(sid=sid, god=self.name)
        s.save()

        self.sendMessage("sid " + sid)

    def sign_ph1(self, name):
        god_info = get_god_info(name)
        if not god_info:
            self.sendMessage("Unknown god name!")
            return
        self.name = god_info['godname']

        user, created = User.get_or_create(god_name=self.name)
        if created or user.motto_login == "":
            motto = rnd_gen(MOTTO_LEN)
            user.motto_login = motto
        else:
            motto = user.motto_login
        user.save()

        self.sendMessage("Change your current motto to: " + motto)

    def sign_ph2(self):
        user = User.get(god_name=self.name)
        req_motto = user.motto_login
        if len(req_motto) < MOTTO_LEN:
            self.sendMessage("Auth missequencing!")
            return

        god_info = get_god_info(self.name)
        if not god_info:
            self.sendMessage("Unknown god name!")
            return
        motto = god_info['motto']

        if motto.find(req_motto) == -1:
            self.sendMessage("Motto-based auth failed!")
            return

        self.password_change = True
        self.sendMessage("Now you can set your password!")

    def passwd(self, password):
        if not self.password_change:
            self.sendMessage("You can change your password only after motto approval")
            return

        user = User.get(god_name=self.name)
        user.password = hashlib.sha1(password.encode()).hexdigest()
        user.motto_login = ""
        user.save()

        self.sendMessage("success")

    def auth_ph1(self, login):
        self.name = login

        try:
            User.get(god_name=self.name)
        except User.DoesNotExist:
            self.sendMessage('{"error": {"msg": "User does not registered"}}')
            return

        self.auth_salt = rnd_gen(32)
        self.sendMessage('{"salt": {"salt": "' + self.auth_salt + '"}}')

    def auth_ph2(self, password):
        if len(self.auth_salt) < 32:
            self.sendMessage("Auth missequencing!")
            return

        user = User.get(god_name=self.name)
        req = hashlib.sha1((user.password + self.auth_salt).encode()).hexdigest()

        if not password == req:
            self.sendMessage('{"error": {"msg": "Auth failed"}}')
            return

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
