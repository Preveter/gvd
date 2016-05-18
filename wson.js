/**
 * WebSocket JSON-based messages handler
 * @param address
 * @return {WSON}
 * @constructor
 */
function WSON(address){
    var ws = new WebSocket(address);
    var handlers = [];

    ws.onmessage = function(event){
        console.log(event.data);

        var data = event.data;
        var msg_arr = JSON.parse(data);
        var names = Object.keys(msg_arr);

        for (var i = 0; i < names.length; i++){
            for (var j = 0; j < handlers.length; j++){
                if (names[i] == handlers[j].m){
                    handlers[j].h(msg_arr[names[i]]);
                }
            }
        }
    };

    this.onopen = function(handler){
        ws.onopen = handler;
    };
    this.onclose = function(handler){
        ws.onclose = handler;
    };

    this.on = function(msg, handler){
        var i;
        for (i = 0; i < handlers.length; i++){
            if (handlers[i].m == msg) break;
        }
        if (i < handlers.length){
            handlers[i].h = handler;
        }else{
            handlers.push({
                m: msg,
                h: handler
            })
        }
    };

    this.send = function(data){
        ws.send(data);
    };

    return this;
}