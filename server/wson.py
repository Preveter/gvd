import json
from tornado import (
    websocket,
    gen,
    ioloop,
)

KEEP_ALIVE_INTERVAL = 60


class WSON(websocket.WebSocketHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.handlers = {}
        ioloop.IOLoop.current().call_later(KEEP_ALIVE_INTERVAL, self.keep_alive)

    def check_origin(self, origin):
        return True

    def open(self):
        print("WebSocket opened")

    def on_close(self):
        print("WebSocket closed")

    def on_message(self, message):
        print("< " + message)
        msg_arr = json.loads(message)
        names = msg_arr.keys()

        for name in names:
            if name in self.handlers:
                self.handlers[name](msg_arr[name])

    @gen.coroutine
    def keep_alive(self):
        while True:
            self.send("keep_alive", {})
            yield gen.sleep(KEEP_ALIVE_INTERVAL)

    def on(self, msg, handler):
        self.handlers[msg] = handler

    def off(self, msg):
        del self.handlers[msg]

    def send(self, msg, data):
        line = json.dumps({msg: data})
        print("> " + line)
        self.write_message(line)

    def send_error_msg(self, err_msg):
        self.send("error", {"msg": err_msg})
