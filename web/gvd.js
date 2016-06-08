(function(){

    function getCookie(name){
        var matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }

    function makeEl(name, options){
        var el = document.createElement(name);
        for(var key in options) {
           if (options.hasOwnProperty(key)) {
               el[key] = options[key];
           }
        }
        return el;
    }

    function GVD(){
        this.users = [];
        this.me = {
            name: "",
            ready: false
        };
        
        var timer_start = 0,
            timer_delay = 0;
        var timer;
        var timerElement = makeEl("div", {id: "timer", innerHTML: ""});

        var el = this.element = document.createElement("div");
        el.id = "gvd";

        this.setMyName = function(name){
            this.me.name = name;
        };

        this.setMyStatus = function(val){
            this.me.ready = val;
        };

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

        this.clearUsers = function(){
            this.users = [];
            this.draw();
        };

        this.getUserByName = function(userName){
            for (var i = 0; i < this.users.length; i++){
                var u = this.users[i];
                if (u.name == userName){
                    return u;
                }
            }
        };

        this.startTimer = function(delay){
            timer_start = Date.now();
            timer_delay = delay*1000;
            timer = setInterval(function(){
                // TODO: удаление gvd не приводит к удалению таймера: поэтому при перелогине он остаётся.
                var now = new Date();
                if (now > timer_start + timer_delay){
                    clearInterval(timer);
                    timerElement ? timerElement.innerHTML = "" : false;
                    if (gvd.me.ready) alert("ПРЫГ!");
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
            var jump = makeEl("input", {
                type: "button",
                id: "jumpButton",
                value: "Прыг!"
            });
            jump.onclick = function(){
                wson.send("jump");
            };

            var exit = makeEl("input", {
                type: "button",
                id: "exitButton",
                value: "Выход!"
            });
            exit.onclick = function(){
                wson.send("logout");
            };

            var lst = makeEl("div", {id: "userList"});
            this.users.forEach(function(user){
                lst.appendChild(user.element);
            });

            var content = makeEl("div",{id: "content"});
            content.appendChild(timerElement);
            content.appendChild(jump);
            content.appendChild(exit);
            content.appendChild(lst);

            el.innerHTML = "";
            el.appendChild(content);
        };

        this.reset = function(){
            this.users = [];
            this.me = {
                name: "",
                ready: false
            };

            timer_start = 0;
            timer_delay = 0;
            
            clearInterval(timer);
        };

        this.draw();
        return this;
    }

    function User(name){
        this.name = name;
        var ready = false;

        var el = this.element = document.createElement("div");
        el.className = "userInfo";
        el.id = "name";

        this.setReady = function(val){
            if (ready != val){
                ready = val;
                this.draw();
            }
        };

        this.draw = function(){
            el.innerHTML = this.name;
            if (ready) el.style.background = "#88ff88";
            else el.style.background = "#ffffff";
        };

        this.draw();
        return this;
    }

    var gvd = new GVD();

    // Web Sockets

    var wson = new WSON("ws://127.0.0.1:8765/");
    
    wson.onopen(function(){
        console.log('Connected');
        checkSID()
    });

    wson.onclose(function(event) {
        if (event.wasClean){
            console.log('Connection closed');
        }else{
            console.log('Connection lost');
        }
        console.log('Code: ' + event.code + '; reason: ' + event.reason);
    });

    var checkSID = function(){
        var sid = getCookie("sid");

        if (sid === undefined){
            console.log("No SID to send.");
            requestLogin();
            return;
        }

        wson.request("sid", {sid: sid}, function(d){
            if (d["status"] == "accepted"){
                console.log("SID accepted!");
                loadData();
            }else{
                console.log("Wrong sid");
                requestLogin();
            }
        });
    };

    var requestLogin = function(){
        
        function auth(){
            var hash1 = Sha1.hash(passwordInput.value);
            var hash2 = Sha1.hash(hash1 + salt);
            wson.send("auth", {login: nameInput.value, password: hash2});
        }
        
        wson.on("auth", function(d){
            if (d.status != "success") {
                alert("Неверный логин или пароль");
                return;
            }
            
            var date = new Date;
            date.setDate(date.getDate() + 365);
            document.cookie = "sid=" + d.sid + "; path=/; expires=" + date.toUTCString();
            console.log("Success auth");
            loadData();
            wson.off("auth");
        });
        
        var salt = null;
        wson.request("salt", {}, function(d){
            salt = d["salt"];
            console.log("Salt: " + salt);
        });

        var nameInput = makeEl("input", {type: "text", id: "nameInput", value: "Preveter"});
        var passwordInput = makeEl("input", {type: "password", id: "passwordInput", value: "11111111"});

        var sign = makeEl("input", {type: "button", id: "signupButton", value: "Регистрация"});
        sign.onclick = signup;

        var confirm = makeEl("input", {type: "button", id: "confirmButton", value: "Войти"});
        confirm.onclick = auth;

        var loginForm = makeEl("div", {id: "loginForm"});
        loginForm.appendChild(nameInput);
        loginForm.appendChild(passwordInput);
        loginForm.appendChild(confirm);
        loginForm.appendChild(sign);

        document.body.innerHTML = "";
        document.body.appendChild(loginForm);
    };

    var signup = function(){
        
        function sendLogin(){
            wson.request("sign", {login: nameInput.value}, function(d){
                signupForm.replaceChild(mottoInput, nameInput);
                mottoInput.value = d["motto"];
                
                confirm.value = "Test";
                confirm.onclick = testMotto;
            });
        }
        
        function testMotto(){
            wson.send("motto");
        }
        
        function sendPassword(){
            wson.request("password", {"password": passInput.value}, requestLogin);
        }
        
        wson.on("motto", function(d){
            if (d["status"] != "accepted") {
                alert("Девиз в API еще не обновился. Попробуйте через минутку.");
                return;
            }
            
            signupForm.replaceChild(passInput, mottoInput);

            confirm.onclick = sendPassword;
            wson.off("motto");
        });
        
        var nameInput = makeEl("input", {type: "text", id: "nameInput", value: "Preveter"});
        var passInput = makeEl("input", {type: "text", value: ""});
        var mottoInput = makeEl("input", {type: "text", onclick: "this.select();"});
        
        var confirm = makeEl("input", {type: "button", id: "confirmButton", value: "Ok"});
        confirm.onclick = sendLogin;
        
        var signupForm = makeEl("div", {id: "signupForm"});
        signupForm.appendChild(nameInput);
        signupForm.appendChild(confirm);

        document.body.innerHTML = "";
        document.body.appendChild(signupForm);
    };

    var loadData = function(){
        wson.request("data", {}, function(d){
            console.log("Data loaded!");

            gvd.reset();
            gvd.setMyName(d["me"]["name"]);
            gvd.setMyStatus(d["me"]["ready"]);

            gvd.clearUsers();
            d["users"].forEach(function(u){
                var user = new User(u);
                gvd.addUser(user);
            });

            if (d["jump"]["active"]){
                gvd.startTimer(d["jump"]["delay"]);
                var users = d["jump"]["ready"];
                users.forEach(function(name){
                    var u = gvd.getUserByName(name);
                    u.setReady(true);
                });
            }

            document.body.innerHTML = "";
            document.body.appendChild(gvd.element);
        });

        wson.on("jump", function(d){
            gvd.startTimer(d["delay"]);
            var u = gvd.getUserByName(d["user"]);
            u.setReady(true);
            if (d["user"] == gvd.me.name){
                gvd.setMyStatus(true);
            }else{
                alert(d["user"] + " has created a party!");
            }
        });

        wson.on("ready", function(d){
            var u = gvd.getUserByName(d["user"]);
            u.setReady(true);
            if (d["user"] == gvd.me.name)
                gvd.setMyStatus(true);
        });

        wson.on("user", function(d){
            if (d["status"] == "on"){
                var u = new User(d["name"]);
                gvd.addUser(u);
            }
            if (d["status"] == "off"){
                gvd.removeUser(gvd.getUserByName(d["name"]));
            }
        });

        wson.on("logout", function(){
            requestLogin();
        })
    };
})();