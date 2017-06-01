var readline   = require("readline");
var fs         = require("fs");
var os         = require("os");
var execSync   = require("child_process").execSync;
var FlagParser = require("flag-parser");

// sudo node main.js -f ../Port-9002-Sample/server.js -e MageLeif@Yahoo.com -n tundrafizz.space -i 34.208.168.25 -p 9002 -d tundrafizz.space -dh PRE

/*
  Requirements: A server that is installed,
  but not running and doesn't have a service file
*/

function SSLNginx(){}

SSLNginx.prototype.Initialize = function(){return new Promise((resolve) => {
  try{
    var yoloSwag = new FlagParser("-w", "--wizard");

    yoloSwag.GetArgs()
    .then((arguments) => {
      // console.log(arguments);
      this.args = arguments;
      this.Run();
    });
  }catch(error){
    console.log(error);
    return;
  }
})};

SSLNginx.prototype.Run = function(){
  this.absolutePath  = this.args["-f"];
  this.mainFile      = this.args["-m"];
  this.email         = this.args["-e"];
  this.projectName   = this.args["-n"];
  this.ip            = this.args["-i"];
  this.port          = this.args["-p"];
  this.domainName    = this.args["-d"];
  this.dhparam       = this.args["-dh"];
  this.wizard        = this.args["-w"];
  this.serviceDir    = `/etc/systemd/system`;
  this.nginxConf     = `/etc/nginx/conf.d/${this.domainName}.conf`;

  this.absolutePath = require("path").resolve(this.absolutePath);
  this.entryPoint   = require("path").basename(this.absolutePath)
  this.absolutePath = require("path").dirname(this.absolutePath);

  this.domainName = `${this.domainName} www.${this.domainName}`;

  if(!fs.existsSync("/etc/letsencrypt/live/dhparam.pem")){
    if(this.dhparam && this.dhparam.toLowerCase() == "generate"){
      console.log("Generating a dhparam.pem file");
      console.log("This will take a very long time");
      console.log("Please be patient");
      execSync("sudo mkdir /etc/letsencrypt");
      execSync("sudo mkdir /etc/letsencrypt/live");
      execSync("sudo openssl dhparam -out /etc/letsencrypt/live/dhparam.pem 2048");
    }else if(this.dhparam && this.dhparam.toLowerCase() == "pre"){
      execSync("sudo mkdir /etc/letsencrypt");
      execSync("sudo mkdir /etc/letsencrypt/live");
      fs.writeFileSync("/etc/letsencrypt/live/dhparam.pem", this.PrebuiltDhparam(), "utf-8");
      execSync("sudo pkill nginx");
      execSync("sudo nginx");
    }else{
      console.log("dhparam.pem doesn't exist. You need to provide the -dh flag with the option of GENERATE or PRE depending on if you want to GENERATE a new dhparam.pem file, or use a PRE-built one.");
    }
  }

  this.CreateServiceFile(this)
  .then(this.CreateNonSSLConf,      this.Error)
  .then(this.RestartNginx,          this.Error)
  .then(this.CreateSSL,             this.Error)
  .then(this.CreateSSLConf,         this.Error)
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

    // Now that the service file has been created...
    execSync(`sudo systemctl daemon-reload`);              // Reload the service files
    execSync(`sudo systemctl enable ${self.projectName}`); // Auto-start on boot
    execSync(`sudo systemctl start ${self.projectName}`);  // Start the service

    resolve(self);
  });
})};

SSLNginx.prototype.CreateNonSSLConf = function(self){return new Promise((resolve) => {
  fs.writeFile(self.nginxConf, self.RoundOne(), function(err){
    resolve(self);
  });
})};

SSLNginx.prototype.RestartNginx = function(self){return new Promise((resolve) => {
  try{
    execSync("sudo pkill nginx");
  }catch(error){
    throw "Could not execute command: sudo pkill nginx";
  }

  try{
    execSync("sudo nginx");
    resolve(self);
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

  execSync(cmd);
  resolve(self);
})};

SSLNginx.prototype.CreateSSLConf = function(self){return new Promise((resolve) => {
  fs.writeFile(self.nginxConf, self.RoundTwo(), function(err){
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
  return `\n`                                                                                                                         +
  `server {\n`                                                                                                                        +
  `  listen 9000;\n`                                                                                                                  +
  `  listen 443 ssl;\n`                                                                                                               +
  `\n`                                                                                                                                +
  `  server_name ${this.domainName};\n`                                                                                               +
  `\n`                                                                                                                                +
  `  if ($scheme = http) {return 301 https://$server_name$request_uri;}\n`                                                            +
  `\n`                                                                                                                                +
  `  ssl_certificate     /etc/letsencrypt/live/${this.projectName}/fullchain.pem;\n`                                                  +
  `  ssl_certificate_key /etc/letsencrypt/live/${this.projectName}/privkey.pem;\n`                                                    +
  `\n`                                                                                                                                +
  `  ssl_protocols TLSv1 TLSv1.1 TLSv1.2;\n`                                                                                          +
  `  ssl_prefer_server_ciphers on;\n`                                                                                                 +
  `  ssl_ciphers "ssl_ciphers ECDH+AESGCM:DH+AESGCM:ECDH+AES256:DH+AES256:ECDH+AES128:DH+AES:RSA+AESGCM:RSA+AES:!aNULL:!MD5:!DSS";\n` +
  `  ssl_ecdh_curve secp384r1;\n`                                                                                                     +
  `  ssl_session_cache shared:SSL:10m;\n`                                                                                             +
  `  ssl_session_tickets off;\n`                                                                                                      +
  `  ssl_stapling on;\n`                                                                                                              +
  `  ssl_stapling_verify on;\n`                                                                                                       +
  `  resolver 8.8.8.8 8.8.4.4 valid=300s;\n`                                                                                          +
  `  resolver_timeout 5s;\n`                                                                                                          +
  `  add_header Strict-Transport-Security "max-age=63072000; includeSubdomains";\n`                                                   +
  `  add_header X-Frame-Options DENY;\n`                                                                                              +
  `  add_header X-Content-Type-Options nosniff;\n`                                                                                    +
  `\n`                                                                                                                                +
  `  ssl_dhparam /etc/letsencrypt/live/dhparam.pem;\n`                                                                                +
  `\n`                                                                                                                                +
  `  location / {proxy_pass http://${this.ip}:${this.port};}\n`                                                                       +
  `}\n`;
};

SSLNginx.prototype.PrebuiltDhparam = function(){
  return `-----BEGIN DH PARAMETERS-----\n`                             +
  `MIICCAKCAgEA1K6ggBjAn6jgRyxWr/dR2ECqXFpt9O4DB/SJ9bRlnudQQCpW4hht\n` +
  `p2o6QcBJoO5Em62wamSyk8sgrVOic0iUZKbDorucSGowk1prnuL5P2J8e7/N8GoO\n` +
  `dWDOz7UEHvr3G3orl5NvHh1y80YH8sE6GlsSyY7CuhjbbQLv4F3FUGU9Ajb1lOy9\n` +
  `bAE7umxYYWOXMDUcV/HsYbQOFgx3zid9drTodgQo6XGdoO5Sc4RGEGqI97k7SRp8\n` +
  `In8p0avwEBKaoKvxYPPi5LSyeGwCSZ6U8J9qKqeMM0D4fJqYY7mmkat7NHzK6MgE\n` +
  `j0q9WnPgFHuDYu1l9fHfLE6mTQorXRG3mif8I+/KyiCZ7UwlSXGIU7biGYVL+cna\n` +
  `KYkeXSkm1ZhcMXyv9JTGd50U43JigGkW309AMKHxozrImTWWLRGD6148f3Y3h3Sx\n` +
  `I011p0i7lzcfM0gnDPSo00dUA7yS3Cwg8OeMSEYvTulqKiiUfntMZF8I+X6C5Uch\n` +
  `qayAOSoGBygNbRuyIOqcDC+UOcVUkZXVO4RiFPrMTjG11CxJJk+bR1p2oIcDSUAC\n` +
  `iy/UsEP+aiEb0JeCgCgIh7PQ91BzWQ2jgrEgK3tEfxhstaL6AV2XRkA/kz1meHPs\n` +
  `QJTTh+d4vjjuA8mf7uVuLvoTDzrY9soM+aAL/cx7sTws+/u7Q3KuuRMCAQI=\n`     +
  `-----END DH PARAMETERS-----\n`;
}

SSLNginx.prototype.Error = function(error) {return new Promise((resolve) => {
  console.log(error);
})};

// =============================================================================

function Main(){
  var sslNginx = new SSLNginx();
  sslNginx.Initialize();
}

Main();
