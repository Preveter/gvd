(function(){

    function getCookie(name){
        var matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }

    ////////////////////////////////////////////////////

    function GVD(){
        this.users = [];
        this.me = {
            name: "",
            ready: false
        };

        var el = this.element = document.getElementById("listContainer");
        
        el.querySelector("#jumpButton").onclick = function(){
            wson.send("jump");
        };
        el.querySelector("#exitButton").onclick.onclick = function(){
            wson.send("logout");
        };

        var timer_start = 0,
            timer_delay = 0;
        var timer;
        var timerElement = el.querySelector("#timer");
        

        this.setMyName = function(name){
            this.me.name = name;
        };

        this.setMyStatus = function(val){
            this.me.ready = val;
        };

        this.addUser = function(user){
            this.users.push(user);
            this.redrawUsers();
        };

        this.removeUser = function(user){
            var i = this.users.indexOf(user);
            if (~i){
                this.users.splice(i,1);
            }
            this.redrawUsers();
        };

        this.clearUsers = function(){
            this.users = [];
            this.redrawUsers();
        };

        this.redrawUsers = function(){
            var lst = el.querySelector("#userList");
            lst.innerHTML = "";
            this.users.forEach(function(user){
                lst.appendChild(user.element);
            });
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
        
        this.activate = function(){
            this.element.style.display = "block";
            
            var t = this;
            
            wson.on("jump", function(d){
                t.startTimer(d["delay"]);
                var u = t.getUserByName(d["user"]);
                u.setReady(true);
                if (d["user"] == t.me.name){
                    t.setMyStatus(true);
                }else{
                    alert(d["user"] + " has created a party!");
                }
            });

            wson.on("ready", function(d){
                var u = t.getUserByName(d["user"]);
                u.setReady(true);
                if (d["user"] == t.me.name)
                    t.setMyStatus(true);
            });

            wson.on("user", function(d){
                if (d["status"] == "on"){
                    var u = new User(d["name"]);
                    t.addUser(u);
                }
                if (d["status"] == "off"){
                    t.removeUser(t.getUserByName(d["name"]));
                }
            });
            
            wson.request("data", {}, function(d){
                console.log("Data loaded!");

                t.reset();
                t.setMyName(d["me"]["name"]);
                t.setMyStatus(d["me"]["ready"]);

                t.clearUsers();
                d["users"].forEach(function(u){
                    var user = new User(u);
                    t.addUser(user);
                });

                if (d["jump"]["active"]){
                    t.startTimer(d["jump"]["delay"]);
                    var users = d["jump"]["ready"];
                    users.forEach(function(name){
                        var u = t.getUserByName(name);
                        u.setReady(true);
                    });
                }
            });
        };
        
        this.deactivate = function(){
            this.element.style.display = "none";
            wson.off("jump");
            wson.off("ready");
            wson.off("user");
            wson.off("logout");
            wson.off("data");
        };

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


    function LoginManager(){

        var el = this.element = document.getElementById("loginContainer");
        //el.querySelector("#signupButton").onclick = this.signup;
        el.querySelector("#confirmButton").onclick = this.send;
        
        var passInput = el.querySelector("#passInput");
        var nameInput = el.querySelector("#nameInput");

        var loginHandler = function(){};
        var logoutHandler = function(){};

        this.onlogin = function(h){
            loginHandler = h;
        };

        this.onlogout = function(h){
            logoutHandler = h;
        };

        this.send = function(){
            var hash1 = Sha1.hash(passInput.value);
            var hash2 = Sha1.hash(hash1 + salt);
            wson.send("auth", {login: nameInput.value, password: hash2});
        };
        
        this.auth = function(sid){
            var date = new Date;
            date.setDate(date.getDate() + 365);
            document.cookie = "sid=" + sid + "; path=/; expires=" + date.toUTCString();
            console.log("Success auth");

            var t = this;
            wson.on("logout", function(){
                t.logout();
            });
            
            this.deactivate();
            loginHandler();
        };

        this.logout = function(){
            logoutHandler();
            this.activate();
        };
        
        this.showLoginForm = function(){
            
            // TODO: Show login form;
            
            var salt = null;
            wson.request("salt", {}, function(d){
                salt = d["salt"];
                console.log("Salt: " + salt);
            });

            var t = this;
            wson.on("auth", function(d){
                if (d.status != "success") {
                    alert("Неверный логин или пароль");
                    return;
                }
                
                wson.off("auth");
                t.auth(d["sid"]);
            });
            
        };

        this.activate = function() {
            this.element.style.display = "block";
            // TODO: Don't show login form just now
            
            var sid = getCookie("sid");

            if (sid === undefined) {
                console.log("No SID to send.");
                this.showLoginForm();
            } else {
                var t = this;
                wson.request("sid", {sid: sid}, function (d) {
                    if (d["status"] == "accepted") {
                        console.log("SID accepted!");

                        t.auth(sid);
                    } else {
                        console.log("Wrong sid");
                        t.showLoginForm();
                    }
                });
            }
        };
        
        this.deactivate = function(){
            this.element.style.display = "none";
        };

        return this;
    }

    ///////////////////////////////////////////
    
    var wson = new WSON("ws://127.0.0.1:8765/");
    
    wson.onopen(function(){
        console.log('Connected');
        window.setTimeout(login.activate, 1000); // TODO: ON DOM LOADED!!!
    });

    wson.onclose(function(event) {
        if (event.wasClean){
            console.log('Connection closed');
        }else{
            console.log('Connection lost');
        }
        console.log('Code: ' + event.code + '; reason: ' + event.reason);
    });

    ///////////////////////////////////////////

    var gvd = new GVD();
    var login = new LoginManager();

    login.onlogin(function(){
        gvd.activate();
    });

    login.onlogout(function(){
        gvd.activate();
    });

/*
    var signup = function(){
        
        function sendLogin(){
            wson.request("sign", {login: nameInput.value}, function(d){
                // TODO: SHOW SECOND PHASE
                mottoInput.value = d["motto"];

                proceedBtn.onclick = testMotto;
            });
        }
        
        function testMotto(){
            wson.send("motto");
        }
        
        function sendPassword(){
            wson.request("password", {"password": passInput.value}, showLoginForm);
        }
        
        wson.on("motto", function(d){
            if (d["status"] != "accepted") {
                alert("Девиз в API еще не обновился. Попробуйте через минутку.");
                return;
            }

            // TODO: SHOW THIRD PHASE

            proceedBtn.onclick = sendPassword;
            wson.off("motto");
        });

        var signupContainer = document.getElementById("signupContainer");

        var proceedBtn = signupContainer.querySelector("#signupProceed");
        var nameInput = signupContainer.querySelector("#s_nameInput");
        var mottoInput = signupContainer.querySelector("#s_mottoInput");
        var passInput = signupContainer.querySelector("#s_passInput");

        proceedBtn.onclick = sendLogin;

        // TODO: SHOW FIRST PHASE
    };
*/
})();