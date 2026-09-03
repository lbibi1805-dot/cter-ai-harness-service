---
title: "POSIX message queues"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# POSIX message queues

POSIX defines a set of nonblocking message-passing facilities known as _message queues_.

Like pipes, message queues are named objects that operate with “readers” and “writers.” As a priority queue of discrete messages, a message queue has more structure than a pipe and offers applications more control over communications. POSIX message queues provide a familiar interface for many realtime programmers, in that they're similar to the “mailboxes” found in many realtime executives.

In order for you to use POSIX message queues, the message queue server must be running. QNX Neutrino has two implementations of message queues:

- a “traditional” implementation that uses the [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html) resource manager (see the “[Resource Managers](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/resource.html "To give the QNX Neutrino RTOS a great degree of flexibility, to minimize the runtime memory requirements of the final system, and to cope with the wide variety of devices that may be found in a custom embedded system, the OS allows user-written processes to act as resource managers that can be started and stopped dynamically.")” chapter in this book)
- an alternate implementation that uses the [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) server and queues in kernel space

For more information about these implementations, see the Utilities Reference and the “[POSIX Message Queues: Two Implementations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html)” technote.

There's a fundamental difference between QNX Neutrino native messages and POSIX message queues: our messages block—they copy their data directly between the address spaces of the processes sending the messages. POSIX message queues, on the other hand, implement a store-and-forward design in which the sender need not block and may have many outstanding messages queued. POSIX message queues exist independently of the processes that use them. You could use message queues in a design where a number of named queues will be operated on by a variety of processes over time.

Which should you use? Message queues, being defined by POSIX, are more portable, but native messages have several advantages:

- better performance
- unbounded, non-fixed message length
- priority inheritance
- known senders

Message queues resemble files, at least as far as their interface is concerned. POSIX defines the following functions that you can use to manage message queues (see the QNX Neutrino C Library Reference for more information):

|Function|Description|
|---|---|
|[mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html)|Open a message queue|
|[mq_close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_close.html)|Close a message queue|
|[mq_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_unlink.html)|Remove a message queue|
|[mq_send()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_send.html)|Add a message to the message queue|
|[mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html)|Receive a message from the message queue|
|[mq_notify()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_notify.html)|Tell the calling process that a message is available on a message queue|
|[mq_setattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_setattr.html)|Set message queue attributes|
|[mq_getattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_getattr.html)|Get message queue attributes|

For strict POSIX conformance, you should create message queues that start with a single slash (/) and contain no other slashes. But note that we extend the POSIX standard by supporting pathnames that may contain multiple slashes. This allows, for example, a company to place all its message queues under its company name and distribute a product with increased confidence that a queue name will _not_ conflict with that of another company.

In QNX Neutrino, all message queues created appear in the filename space under the directory:

- /dev/mqueue if you're using the traditional ([mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html)) implementation
- /dev/mq if you're using the alternate ([mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html)) implementation

For example, with the traditional implementation:

|mq_open() name:|Pathname of message queue:|
|---|---|
|/data|/dev/mqueue/data|
|/acme/data|/dev/mqueue/acme/data|
|/qnx/data|/dev/mqueue/qnx/data|

You can display all message queues in the system using the ls command as follows:

ls -Rl /dev/mqueue

The size printed is the number of messages waiting.

### Related concepts  

[POSIX Message Queues: Two Implementations (Technotes)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html "POSIX Message Queues: Two Implementations (Technotes)")

### Related reference  

[mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html "mq")

[mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html "mqueue")

[mq_close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_close.html "mq_close()")

[mq_getattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_getattr.html "mq_getattr()")

[mq_notify()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_notify.html "mq_notify()")

[mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "mq_open()")

[mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html "mq_receive()")

[mq_send()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_send.html "mq_send()")

[mq_setattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_setattr.html "mq_setattr()")

[mq_timedreceive(), mq_timedreceive_monotonic()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_timedreceive.html "mq_timedreceive(), mq_timedreceive_monotonic()")

[mq_timedsend(), mq_timedsend_monotonic()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_timedsend.html "mq_timedsend(), mq_timedsend_monotonic()")

[mq_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_unlink.html "mq_unlink()")

POSIX defines a set of nonblocking message-passing facilities known as _message queues_.

Like pipes, message queues are named objects that operate with “readers” and “writers.” As a priority queue of discrete messages, a message queue has more structure than a pipe and offers applications more control over communications. POSIX message queues provide a familiar interface for many realtime programmers, in that they're similar to the “mailboxes” found in many realtime executives.

In order for you to use POSIX message queues, the message queue server must be running. QNX Neutrino has two implementations of message queues:

- a “traditional” implementation that uses the [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html) resource manager (see the “[Resource Managers](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/resource.html "To give the QNX Neutrino RTOS a great degree of flexibility, to minimize the runtime memory requirements of the final system, and to cope with the wide variety of devices that may be found in a custom embedded system, the OS allows user-written processes to act as resource managers that can be started and stopped dynamically.")” chapter in this book)
- an alternate implementation that uses the [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) server and queues in kernel space

For more information about these implementations, see the Utilities Reference and the “[POSIX Message Queues: Two Implementations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html)” technote.

There's a fundamental difference between QNX Neutrino native messages and POSIX message queues: our messages block—they copy their data directly between the address spaces of the processes sending the messages. POSIX message queues, on the other hand, implement a store-and-forward design in which the sender need not block and may have many outstanding messages queued. POSIX message queues exist independently of the processes that use them. You could use message queues in a design where a number of named queues will be operated on by a variety of processes over time.

Which should you use? Message queues, being defined by POSIX, are more portable, but native messages have several advantages:

- better performance
- unbounded, non-fixed message length
- priority inheritance
- known senders

Message queues resemble files, at least as far as their interface is concerned. POSIX defines the following functions that you can use to manage message queues (see the QNX Neutrino C Library Reference for more information):

|Function|Description|
|---|---|
|[mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html)|Open a message queue|
|[mq_close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_close.html)|Close a message queue|
|[mq_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_unlink.html)|Remove a message queue|
|[mq_send()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_send.html)|Add a message to the message queue|
|[mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html)|Receive a message from the message queue|
|[mq_notify()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_notify.html)|Tell the calling process that a message is available on a message queue|
|[mq_setattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_setattr.html)|Set message queue attributes|
|[mq_getattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_getattr.html)|Get message queue attributes|

For strict POSIX conformance, you should create message queues that start with a single slash (/) and contain no other slashes. But note that we extend the POSIX standard by supporting pathnames that may contain multiple slashes. This allows, for example, a company to place all its message queues under its company name and distribute a product with increased confidence that a queue name will _not_ conflict with that of another company.

In QNX Neutrino, all message queues created appear in the filename space under the directory:

- /dev/mqueue if you're using the traditional ([mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html)) implementation
- /dev/mq if you're using the alternate ([mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html)) implementation

For example, with the traditional implementation:

|mq_open() name:|Pathname of message queue:|
|---|---|
|/data|/dev/mqueue/data|
|/acme/data|/dev/mqueue/acme/data|
|/qnx/data|/dev/mqueue/qnx/data|

You can display all message queues in the system using the ls command as follows:

ls -Rl /dev/mqueue

The size printed is the number of messages waiting.

### Related concepts  

[POSIX Message Queues: Two Implementations (Technotes)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html "POSIX Message Queues: Two Implementations (Technotes)")

### Related reference  

[mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html "mq")

[mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html "mqueue")

[mq_close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_close.html "mq_close()")

[mq_getattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_getattr.html "mq_getattr()")

[mq_notify()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_notify.html "mq_notify()")

[mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "mq_open()")

[mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html "mq_receive()")

[mq_send()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_send.html "mq_send()")

[mq_setattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_setattr.html "mq_setattr()")

[mq_timedreceive(), mq_timedreceive_monotonic()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_timedreceive.html "mq_timedreceive(), mq_timedreceive_monotonic()")

[mq_timedsend(), mq_timedsend_monotonic()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_timedsend.html "mq_timedsend(), mq_timedsend_monotonic()")

[mq_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_unlink.html "mq_unlink()")
