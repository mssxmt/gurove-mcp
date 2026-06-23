import * as osc from "osc";

const GUROVE_IP = "127.0.0.1";
const RECEIVE_PORT = 9002;
const SEND_PORT = 9001;

export class OscBridge {
  private udp: any;

  constructor() {
    this.udp = new osc.UDPPort({
      localAddress: GUROVE_IP,
      localPort: RECEIVE_PORT,
      remoteAddress: GUROVE_IP,
      remotePort: SEND_PORT,
    });
    this.udp.open();
  }

  /** Send an OSC message to GuRove (fire-and-forget). */
  send(address: string, ...args: (number | string)[]): void {
    this.udp.send({ address, args: args.map((a) => ({ type: typeof a === "number" ? (Number.isInteger(a) ? "i" : "f") : "s", value: a })) });
  }

  /** Send OSC and wait for a reply (with timeout). */
  async sendAndWait(address: string, replyAddress: string, ...args: (number | string)[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.udp.off("message", handler);
        reject(new Error(`OSC timeout waiting for ${replyAddress}`));
      }, 2000);

      const handler = (msg: any) => {
        if (msg.address === replyAddress) {
          clearTimeout(timeout);
          this.udp.off("message", handler);
          resolve(msg);
        }
      };

      this.udp.on("message", handler);
      this.send(address, ...args);
    });
  }

  close(): void {
    this.udp.close();
  }
}
