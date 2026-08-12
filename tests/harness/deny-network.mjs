import http from "node:http";
import https from "node:https";
import net from "node:net";
import dgram from "node:dgram";
import { syncBuiltinESMExports } from "node:module";

function denied() {
  throw new Error("network access is denied in normal-change JARVIS tests");
}

globalThis.fetch = denied;
http.request = denied;
http.get = denied;
https.request = denied;
https.get = denied;
net.connect = denied;
net.createConnection = denied;
dgram.createSocket = denied;
syncBuiltinESMExports();
