function getCookie(name) {
  var matches = document.cookie.match(new RegExp(
    "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
  ));
  return matches ? decodeURIComponent(matches[1]) : undefined;
}

(function gvd(){

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
            var hash2 = Sha1.hash(hash1 + d.salt);
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
            drawContent(d);
        });
        wson.send("load");

        wson.on("jump", function(d){
            alert("JUMP!!!!");
        });
    };

    var drawContent = function(d){
        var content = document.createElement("div");
        content.id = "content";

        var jump = document.createElement("input");
        jump.type = "button";
        jump.id = "jumpButton";
        jump.value = "Прыг!";
        jump.onclick = function(){
            wson.send("jump");
        };
        content.appendChild(jump);

        var lst = document.createElement("ul");
        lst.id = "userList";
        d["users"].forEach(function (name) {
            var user = document.createElement("li");
            user.innerHTML = name;
            lst.appendChild(user);
        });
        content.appendChild(lst);

        document.body.innerHTML = "";
        document.body.appendChild(content);
    };
})();