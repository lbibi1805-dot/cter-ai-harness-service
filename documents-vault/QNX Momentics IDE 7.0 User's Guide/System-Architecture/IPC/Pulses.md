---
title: "Pulses"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# Pulses
In addition to the synchronous Send/Receive/Reply services, the OS also supports fixed-size, nonblocking messages. These are referred to as _pulses_ and carry a small payload (four bytes of data plus a single byte code).

Pulses pack a relatively small payload—eight bits of code and 32 bits of data. Pulses are often used as a notification mechanism within interrupt handlers. They also allow servers to signal clients without blocking on them.

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/pulse.png) 
Figure 1. Pulses pack a small payload.

### Related concepts  

[Pulses (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_msg_Pulses.html "Pulses (Getting Started with QNX Neutrino)")

### Related reference  

[MsgReceivePulsev(), MsgReceivePulsev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivepulsev.html "MsgReceivePulsev(), MsgReceivePulsev_r()")

[MsgReceivePulse(), MsgReceivePulse_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivepulse.html "MsgReceivePulse(), MsgReceivePulse_r()")

[MsgSendPulse(), MsgSendPulse_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulse.html "MsgSendPulse(), MsgSendPulse_r()")
