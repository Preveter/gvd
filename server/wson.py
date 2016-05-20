import json

from SimpleWebSocketServer import WebSocket


class WSON(WebSocket):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.handlers = {}

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
