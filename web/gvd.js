(function(){

    function getCookie(name){
        var matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }

    function GVD(){
        this.users = [];

/*        var states = ["init", "login", "signup", "work"];
        this.state = "";
        this.changeState = function(state){
            if (!~states.indexOf(state)) throw new Error("Wrong state name");
            this.state = state;
        };*/

        var timer_start = 0,
            timer_delay = 0;
        var timer;
        var timerElement = null;

        var el = this.element = document.createElement("div");
        el.id = "gvd";

        this.addUser = function(user){
            this.users.push(user);
            this.draw();
        };

        this.removeUser = function(user){
            var i = this.users.indexOf(user);
            if (~i){
                this.users.splice(i,1);
            }
            this.draw();
        };

        this.startTimer = function(delay){
            timer_start = Date.now();
            timer_delay = delay*1000;
            timer = setInterval(function(){
                var now = new Date();
                if (now > timer_start + timer_delay){
                    clearInterval(timer);
                    timerElement ? timerElement.innerHTML = "" : false;
                    alert("ПРЫГ!");
                }else{
                    var jt = new Date(timer_start + timer_delay);
                    var left = parseInt((jt - now)/1000);
                    var left_str =
                        ((left-left%60)/60<10?'0':'') + (left-left%60)/60 +
                        ":" +
                        (left%60<10?'0':'') + left%60;
                    timerElement ? timerElement.innerHTML = left_str : false;
                }
            },300)
        };

        this.draw = function(){
            el.innerHTML = "";

            var content = document.createElement("div");
            content.id = "content";

            var tmr = document.createElement("div");
            tmr.id = "timer";
            tmr.innerHTML = "";
            timerElement = tmr;
            content.appendChild(tmr);

            var jump = document.createElement("input");
            jump.type = "button";
            jump.id = "jumpButton";
            jump.value = "Прыг!";
            jump.onclick = function(){
                wson.send("jump");
            };
            content.appendChild(jump);

            var lst = document.createElement("div");
            lst.id = "userList";
            this.users.forEach(function(user){
                lst.appendChild(user.element);
            });
            content.appendChild(lst);

            el.appendChild(content);
        };

        this.draw();
        return this;
    }

    function User(name){
        this.name = name;
        this.ready = "";

        var el = this.element = document.createElement("div");
        el.className = "userInfo";
        el.id = "name";

        this.draw = function(){
            el.innerHTML = this.name;
            if (this.ready) el.style.background = "#88ff88";
            else el.style.background = "#ffffff";
        };

        this.draw();
        return this;
    }

    var gvd = window.gvd = new GVD();

    // Web Sockets

    var wson = new WSON("ws://127.0.0.1:8765/");
    
    wson.onopen(function(){
        console.log('Connected');
        sidAuth()
    });

    wson.onclose(function(event) {
        if (event.wasClean){
            console.log('Connection closed');
        }else{
            console.log('Connection lost');
        }
        console.log('Code: ' + event.code + '; reason: ' + event.reason);
    });

    var sidAuth = function(){
        var sid = getCookie("sid");
        if (sid !== undefined){
            wson.on("sid", function(d){
                if (d.status == "accepted"){
                    console.log("SID accepted!");
                    loadData();
                }else{
                    console.log("Wrong sid");
                    requestLogin();
                }
                wson.off("sid");
            });
            wson.send("sid", {sid: sid});
        }else{
            console.log("No SID to send.");
            requestLogin();
        }
    };

    var requestLogin = function(){
        var loginForm = document.createElement("div");
        loginForm.id = "loginForm";

        var nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.id = "nameInput";
        nameInput.value = "Preveter";
        loginForm.appendChild(nameInput);

        var passwordInput = document.createElement("input");
        passwordInput.type = "password";
        passwordInput.id = "passwordInput";
        passwordInput.value = "11111111";
        loginForm.appendChild(passwordInput);

        var confirm = document.createElement("input");
        confirm.type = "button";
        confirm.id = "confirmButton";
        confirm.value = "Войти";
        confirm.onclick = function(){
            wson.send("login", {login: nameInput.value});
        };
        loginForm.appendChild(confirm);

        wson.on("salt", function(d){
            var hash1 = Sha1.hash(passwordInput.value);
            var hash2 = Sha1.hash(hash1 + d["salt"]);
            wson.send("auth", {password: hash2});
            wson.off("salt");
        });
        
        wson.on("auth", function(d){
            if (d.status == "success"){
                var date = new Date;
                date.setDate(date.getDate() + 365);
                document.cookie = "sid=" + d.sid + "; path=/; expires=" + date.toUTCString();
                console.log("Success auth");
                loadData();
                wson.off("auth");
            }else{
                alert("Неверный пароль");
            }
        });

        document.body.innerHTML = "";
        document.body.appendChild(loginForm);
    };

    var loadData = function(){
        wson.on("data", function(d){
            console.log("Data loaded!");
            d["users"].forEach(function(u){
                var user = new User(u);
                gvd.addUser(user);
            });

            if (d["jump"]["active"]){
                // TODO: Mark users
                gvd.startTimer(d["jump"]["delay"]);
            }

            document.body.innerHTML = "";
            document.body.appendChild(gvd.element);
        });
        wson.send("load");

        wson.on("jump", function(d){
            alert(d["user"] + " has created a party!");
            gvd.startTimer(d["delay"]);
        });

        wson.on("ready", function(d){
            alert(d["name"] + " has joined the party!");
        });
    };
})();