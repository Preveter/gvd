(function gvd(){

    var wson = new WSON("ws://127.0.0.1:8765/");
    
    wson.onopen(function(){
        console.log('Connected');
        // TODO: Try sid-based auth
        requestLogin();
    });

    wson.onclose(function(event) {
        if (event.wasClean){
            console.log('Connection closed');
        }else{
            console.log('Connection lost');
        }
        console.log('Code: ' + event.code + '; reason: ' + event.reason);
    });

    var requestLogin = function(){
        var loginForm = document.createElement("div");
        loginForm.id = "loginForm";

        var nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.id = "nameInput";
        loginForm.appendChild(nameInput);

        var passwordInput = document.createElement("input");
        passwordInput.type = "password";
        passwordInput.id = "passwordInput";
        loginForm.appendChild(passwordInput);

        var confirm = document.createElement("input");
        confirm.type = "button";
        confirm.id = "confirmButton";
        confirm.value = "Войти";
        confirm.onclick = function(){
            wson.send("login " + nameInput.value);
        };
        loginForm.appendChild(confirm);

        wson.on("salt", function(d){
            var hash1 = Sha1.hash(passwordInput.value);
            var hash2 = Sha1.hash(hash1 + d.salt);
            wson.send("auth " + hash2);
        });
        
        document.body.appendChild(loginForm);
    }
})();