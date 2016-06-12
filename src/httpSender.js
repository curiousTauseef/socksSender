"use strict";

const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const path = require("path");

let fileConfigs = {};
const serverConfig = {
  hostname: "localhost",
  port: 8010
};

console.log("start server");

let routes = [];
function register( reg, cb ) {
  routes.push({reg, cb});
}

https.createServer( {
  key: fs.readFileSync('./certificate/key.pem', 'utf-8'),
  cert: fs.readFileSync('./certificate/cert.pem', 'utf-8')
} , (req, res) => {
  routes.some(route => {
    if (route.reg.test(req.url)){
      route.cb(req, res);
      return true;
    }
    return false;
  });
}).listen(8013);


const blocksize = 1;

function prepareFile(filePath){
  let config = {
    stat: fs.statSync(filePath),
    fd: fs.openSync(filePath, "r"),
    start: Date.now()
  };
  config.blocks = Math.ceil(config.stat.size / blocksize);
  fileConfigs[filePath] = config;
}

function sendFilePart(filePath, blocknum){
  const config = fileConfigs[filePath];
  const size = blocknum === config.blocks - 1 ? config.stat.size % blocksize : blocksize;
  const buf = new Buffer(size);

  (new Promise((resolve,reject) => fs.read(
    config.fd,
    buf,
    0,
    size,
    blocknum * blocksize,
    (err, byteRead, buffer) => {
      if (err){
        reject(err);
      } else {
        resolve(buffer);
      }
    }
  ))).then(buf => {
    const hash = crypto.createHash("md5");
    hash.update(buf);

    var req = https.request({
      hostname: serverConfig.hostname,
      port: serverConfig.port,
      path: "/saveData",
      method: "POST",
      rejectUnauthorized: false,
      headers: {
        file: encodeURI( path.basename(filePath) ),
        md5: hash.digest("hex"),
        blocknum: blocknum,
        blocksize: blocksize
      }
    }, res => {
      res.on('data', d=>{
        console.log(d.toString("utf-8"));
      });
    });

    req.write(buf);
    req.end();
  }).catch(e => {
    console.error(e);
  });
}

prepareFile("package.json");

sendFilePart("package.json", 0);
sendFilePart("package.json", 1);
sendFilePart("package.json", 2);