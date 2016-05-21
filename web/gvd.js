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
            var tmr = makeEl("div", {
                id: "timer",
                innerHTML: ""
            });
            timerElement = tmr;

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
            content.appendChild(tmr);
            content.appendChild(jump);
            content.appendChild(exit);
            content.appendChild(lst);

            el.innerHTML = "";
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
        confirm.onclick = function(){
            var hash1 = Sha1.hash(passwordInput.value);
            var hash2 = Sha1.hash(hash1 + salt);
            wson.send("auth", {login: nameInput.value, password: hash2});
        };
        
        wson.on("auth", function(d){
            if (d.status == "success"){
                var date = new Date;
                date.setDate(date.getDate() + 365);
                document.cookie = "sid=" + d.sid + "; path=/; expires=" + date.toUTCString();
                console.log("Success auth");
                loadData();
                wson.off("auth");
            }else{
                alert("Неверный логин или пароль");
            }
        });

        var loginForm = makeEl("div", {id: "loginForm"});
        loginForm.appendChild(nameInput);
        loginForm.appendChild(passwordInput);
        loginForm.appendChild(confirm);
        loginForm.appendChild(sign);

        document.body.innerHTML = "";
        document.body.appendChild(loginForm);
    };

    var signup = function(){
        var signupForm = document.createElement("div");
        signupForm.id = "signupForm";

        var nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.id = "nameInput";
        nameInput.value = "Preveter";
        signupForm.appendChild(nameInput);

        var mottoInput = document.createElement("input");

        var confirm = document.createElement("input");
        confirm.type = "button";
        confirm.id = "confirmButton";
        confirm.value = "Ok";
        confirm.onclick = function(){
            wson.on("sign", function(d){
                mottoInput.type = "text";
                mottoInput.value = d["motto"];
                mottoInput.onclick = function(){
                    mottoInput.select();
                };
                signupForm.replaceChild(mottoInput, nameInput);

                confirm.onclick = function(){
                    wson.send("motto");
                };
                wson.off("sign");
            });

            wson.send("sign", {login: nameInput.value});

            wson.on("motto", function(d){
                if (d["status"] == "accepted"){
                    var passInput = document.createElement("input");
                    passInput.type = "text";
                    passInput.value = "";
                    
                    signupForm.replaceChild(passInput, mottoInput);

                    confirm.onclick = function(){
                        wson.on("success", function(){
                            wson.off("success");
                            requestLogin();
                        });
                        wson.send("passwd", {"password": passInput.value});
                    };
                    wson.off("motto");
                }else{
                    alert("Девиз в API еще не обновился. Попробуйте через минутку.");
                }
            });
        };
        signupForm.appendChild(confirm);

        document.body.innerHTML = "";
        document.body.appendChild(signupForm);
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

        wson.on("logout", function(){
            requestLogin();
        })
    };
})();