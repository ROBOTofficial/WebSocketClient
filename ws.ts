import https from "node:https";
import http from "node:http";
import crypto from "node:crypto";
import { Socket } from "node:net"
import event from "node:events";

export class WebSocket extends event.EventEmitter {
    hostname:string
    protocol:string
    pathname:string
    request:{
        (options: string | https.RequestOptions | URL, callback?: ((res: http.IncomingMessage) => void) | undefined): http.ClientRequest;
        (url: string | URL, options: https.RequestOptions, callback?: ((res: http.IncomingMessage) => void) | undefined): http.ClientRequest;
    }
    port:number
    req:http.ClientRequest
    socket:null|Socket

    constructor(url:string) {
        super()
        const { hostname, protocol, pathname, port } = new URL(url)
        const CheckWSS = protocol === "wss:"

        this.hostname = hostname
        this.protocol = protocol
        this.pathname = pathname
        this.request = CheckWSS ? https.request : http.request
        this.port = port === "" ? CheckWSS ? 443 : 80 : Number(port)
        this.socket = null

        const key = crypto.randomBytes(16).toString('base64')

        this.req = this.request({
            port:this.port,
            hostname:this.hostname.startsWith("[") ? this.hostname.slice(1,-1) : this.hostname,
            path:pathname,
            method:`GET`,
            headers: {
                "Host": `${this.hostname}:${this.port}`,
                "Upgrade": "websocket",
                "Connection": "Upgrade",
                "Sec-WebSocket-Key": key,
                "Sec-WebSocket-Version": "13"
            }
        })

        this.req.on("upgrade",(res,socket,head) => {
            this.socket = socket

            socket.on("connect",() => this.emit("open"))
            socket.on("data",(data) => {
                let buf = Buffer.from(data).slice(2)
                this.emit("message",buf)
            })
            socket.on("close",() => this.emit("close"))
        })

        this.emit("HELLO")
        
        this.req.end()
    }
    send(content:any) {
        if (this.socket === null) throw new Error("Cannot Connect WebSocket")
        let buf = Buffer.from(content, "utf-8")
    
        let newBuffer = Buffer.alloc(buf.length + 6)
        buf.copy(newBuffer, 6)
        newBuffer[0] = 0x81
        newBuffer[1] = 0x80 | buf.length

        const mask = Buffer.from([
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 256)
        ])
        mask.copy(newBuffer, 2)

        for (let i = 0; i < buf.length; i++) {
            newBuffer[i + 6] ^= mask[i % 4]
        }
    
        this.socket.write(newBuffer);
    }
}
