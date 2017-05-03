var readline   = require("readline");
var fs         = require("fs");
var os         = require("os");
var execSync   = require("child_process").execSync;
var FlagParser = require("flag-parser");

// cls && node main.js -a test-server.js -e MageLeif@Yahoo.com -n YoloProj -i 127.0.0.1 -p 80 -d google.com

/*
  Requirements: A server that's already running
*/

function SSLNginx(){}

SSLNginx.prototype.Initialize = function(){return new Promise((resolve) => {
  try{
    var yoloSwag = new FlagParser("-w", "--wizard");

    yoloSwag.GetArgs()
    .then((arguments) => {
      console.log(arguments);
      this.args = arguments;
      this.Run();
    });
  }catch(error){
    console.log(error);
    return;
  }
})};

SSLNginx.prototype.Run = function(){
  this.cwd           = __dirname.replace(/\\/g, "/");
  this.serviceDir    = "/etc/systemd/system";
  this.nginxConf     = "/etc/nginx/conf.d/mysites.conf";
  this.absolutePath  = this.args["-f"];
  this.mainFile      = this.args["-m"];
  this.email         = this.args["-e"];
  this.projectName   = this.args["-n"];
  this.ip            = this.args["-i"];
  this.port          = this.args["-p"];
  this.domainName    = this.args["-d"];
  this.wizard        = this.args["-w"];
  this.isWindows     = os.platform().includes("win"); // Debug purposes

  this.absolutePath = require("path").resolve(this.absolutePath);
  this.entryPoint   = require("path").basename(this.absolutePath)
  this.absolutePath = require("path").dirname(this.absolutePath);
  console.log(this.absolutePath);
  console.log(this.entryPoint);

  this.domainName = `${this.domainName} www.${this.domainName}`;

  if(this.isWindows){
    this.serviceDir = "C:/Users/leif.coleman/Desktop/conf";
    this.nginxConf  = "C:/Users/leif.coleman/Desktop/conf/mysites.conf";
  }

  this.CreateServiceFile(this)
  .then(this.CreateBackupNginxConf, this.Error)
  .then(this.AppendFile,            this.Error)
  .then(this.RestartNginx,          this.Error)
  .then(this.CreateSSL,             this.Error)
  .then(this.RestoreOriginalConf,   this.Error)
  .then(this.AppendConfSSL,         this.Error)
  .then(this.RestartNginx,          this.Error);
}

SSLNginx.prototype.CreateServiceFile = function(self){return new Promise((resolve) => {
  var data =
  `[Service]\n`                                                       +
  `User=centos\n`                                                     +
  `Environment=NODE_ENV=production\n`                                 +
  `WorkingDirectory=${self.absolutePath}\n`                           +
  `ExecStart=/usr/bin/node ${self.absolutePath}/${self.entryPoint}\n` +
  `Restart=always\n`                                                  +
  `\n`                                                                +
  `[Install]\n`                                                       +
  `WantedBy=multi-user.target\n`;

  var file = `${self.serviceDir}/${self.projectName}.service`;
  fs.writeFile(file, data, function(err){
    if(err){
      console.log(err);
      throw err;
    }

    resolve(self);
  });
})};

SSLNginx.prototype.CreateBackupNginxConf = function(self){return new Promise((resolve) => {
  var oldFile = `${self.nginxConf}`;
  var newFile = `${self.nginxConf}.orig`;
  var cmd = `copy /Y "${oldFile}" "${newFile}"`;

  try{
    execSync(cmd);
    resolve(self);
  }catch(error){
    var error = "Failed to create a backup of the nginx configuration file.\n";
    error += "Are you sure you have the correct path and filename?"
    throw error;
  }
})};

SSLNginx.prototype.AppendFile = function(self){return new Promise((resolve) => {
  var file = `${self.nginxConf}`;
  console.log(file);

  fs.appendFile(file, self.RoundOne(), function(err){
    resolve(self);
  });
})};

SSLNginx.prototype.RestartNginx = function(self){return new Promise((resolve) => {
  if(self.isWindows){
    console.log("Simulating RestartNginx on Windows");
    resolve(self);
    return;
  }

  try{
    execSync("sudo pkill nginx");
  }catch(error){
    throw "Could not execute command: sudo pkill nginx";
  }

  try{
    execSync("sudo nginx");
    resolve();
  }catch(error){
    throw "Could not execute command: sudo nginx";
  }
})};

SSLNginx.prototype.CreateSSL = function(self){return new Promise((resolve) => {
  console.log("Create SSL certificate");

  var domNames = self.domainName.split(" ");
  var domains  = "";

  for(var i = 0; i < domNames.length; i++){
    domains += `-d ${domNames[i]} `;
  }

  var cmd = `sudo certbot certonly --non-interactive --webroot --agree-tos --email ${self.email} -w ${self.absolutePath}/static ${domains}`;
  console.log(cmd);

  if(self.isWindows){
    resolve(self);
    return;
  }

  execSync(cmd);
  resolve(self);
})};

SSLNginx.prototype.RestoreOriginalConf = function(self){return new Promise((resolve) => {
  var oldFile = `${self.nginxConf}.orig`;
  var newFile = `${self.nginxConf}`;
  console.log(newFile);
  var cmd = `copy /Y "${oldFile}" "${newFile}"`;

  try{
    execSync(cmd);
    resolve(self);
  }catch(error){
    var error = "Failed to restore the original nginx configuration file.\n";
    error += "Are you sure you have the correct path and filename?"
    throw error;
  }
})};

SSLNginx.prototype.AppendConfSSL = function(self){return new Promise((resolve) => {
  var file = `${self.nginxConf}`;

  console.log("Append to file the SSL info");
  fs.appendFile(file, self.RoundTwo(), function(err){
    console.log("File appended");
    resolve(self);
  });
})};

SSLNginx.prototype.RoundOne = function(){
  return `\n`                                                   +
  `server {\n`                                                  +
  `  listen 9000;\n`                                            +
  `  server_name ${this.domainName};\n`                         +
  `  location / {proxy_pass http://${this.ip}:${this.port};}\n` +
  `}\n`;
};

SSLNginx.prototype.RoundTwo = function(){
  return `\n`                                                                        +
  `server {\n`                                                                       +
  `  listen 9000;\n`                                                                 +
  `  listen 443 ssl;\n`                                                              +
  `\n`                                                                               +
  `  server_name ${this.domainName};\n`                                              +
  `\n`                                                                               +
  `  if ($scheme = http) {return 301 https://$server_name$request_uri;}\n`           +
  `\n`                                                                               +
  `  ssl_certificate     /etc/letsencrypt/live/${this.projectName}/fullchain.pem;\n` +
  `  ssl_certificate_key /etc/letsencrypt/live/${this.projectName}/privkey.pem;\n`   +
  `\n`                                                                               +
  `  ssl_protocols TLSv1 TLSv1.1 TLSv1.2;\n`                                         +
  `  ssl_prefer_server_ciphers on;\n`                                                +
  `  ssl_ciphers "EECDH+AESGCM:EDH+AESGCM:AES256+EECDH:AES256+EDH";\n`               +
  `  ssl_ecdh_curve secp384r1;\n`                                                    +
  `  ssl_session_cache shared:SSL:10m;\n`                                            +
  `  ssl_session_tickets off;\n`                                                     +
  `  ssl_stapling on;\n`                                                             +
  `  ssl_stapling_verify on;\n`                                                      +
  `  resolver 8.8.8.8 8.8.4.4 valid=300s;\n`                                         +
  `  resolver_timeout 5s;\n`                                                         +
  `  add_header Strict-Transport-Security "max-age=63072000; includeSubdomains";\n`  +
  `  add_header X-Frame-Options DENY;\n`                                             +
  `  add_header X-Content-Type-Options nosniff;\n`                                   +
  `\n`                                                                               +
  `  ssl_dhparam /etc/letsencrypt/live/dhparam.pem;\n`                               +
  `\n`                                                                               +
  `  location / {proxy_pass http://${this.ip}:${this.port};}\n`                      +
  `}\n`;
};

SSLNginx.prototype.Error = function(error) {return new Promise((resolve) => {
  console.log(error);
})};

// =============================================================================

function Main(){
  var sslNginx = new SSLNginx();
  sslNginx.Initialize();
}

Main();
