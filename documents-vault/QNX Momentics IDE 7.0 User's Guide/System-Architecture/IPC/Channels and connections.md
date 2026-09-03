---
title: "Channels and connections"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# Channels and connections

In the QNX Neutrino RTOS, message passing is directed towards channels and connections, rather than targeted directly from thread to thread. A thread that wishes to receive messages first creates a channel; another thread that wishes to send a message to that thread must first make a connection by “attaching” to that channel.

Channels are required by the message kernel calls and are used by servers to [MsgReceive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html) messages on. Connections are created by client threads to “connect” to the channels made available by servers. Once connections are established, clients can [MsgSend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html) messages over them. If a number of threads in a process all attach to the same channel, then the connections all map to the same kernel object for efficiency. Channels and connections are named within a process by a small integer identifier. Client connections map directly into file descriptors.

Architecturally, this is a key point. By having client connections map directly into FDs, we have eliminated yet another layer of translation. We don't need to “figure out” where to send a message based on the file descriptor (e.g., via a read(fd) call). Instead, we can simply send a message directly to the “file descriptor” (i.e., connection ID).

|Function|Description|
|---|---|
|[ChannelCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html)|Create a channel to receive messages on.|
|[ChannelDestroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channeldestroy.html)|Destroy a channel.|
|[ConnectAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/connectattach.html)|Create a connection to send messages on.|
|[ConnectDetach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/connectdetach.html)|Detach a connection.|

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/connect.png) 
Figure 1. Connections map elegantly into file descriptors.

A process acting as a server would implement an event loop to receive and process messages as follows:

chid = ChannelCreate(flags);
SETIOV(&iov, &msg, sizeof(msg));
for(;;) {
    rcv_id = MsgReceivev( chid, &iov, parts, &info );

    switch( msg.type ) {
        /* Perform message processing here */
        }

    MsgReplyv( rcv_id, &iov, rparts );
    }

This loop allows the thread to receive messages from any thread that had a connection to the channel.

The server can also use [name_attach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/n/name_attach.html) to create a channel and associate a name with it. The sender process can then use [name_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/n/name_open.html) to locate that name and create a connection to it.

The channel has several lists of messages associated with it:

Receive

A LIFO queue of threads waiting for messages.

Send

A priority FIFO queue of threads that have sent messages that haven't yet been received.

Reply

An unordered list of threads that have sent messages that have been received, but not yet replied to.

While in any of these lists, the waiting thread is blocked (i.e., RECEIVE-, SEND-, or REPLY-blocked). Multiple threads and multiple clients may wait on one channel.

### Related concepts  

[Message Passing (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_msg.html "Message Passing (Getting Started with QNX Neutrino)")

### Related reference  

[ChannelCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html "ChannelCreate()")

[ChannelDestroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channeldestroy.html "ChannelDestroy()")
