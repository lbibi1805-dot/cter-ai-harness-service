---
title: "mq_notify()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# mq_notify()
_Ask to be notified when there's a message in the queue_

## Synopsis:

```c
#include <mqueue.h>

int mq_notify(
       mqd_t mqdes, 
       const struct sigevent* notification );
```

## Arguments:

**mqdes** —

The message-queue descriptor, returned by [mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "Open a message queue"), of the message queue that you want to get notification for.

**notification** —

NULL, or a pointer to a [sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html "Structure that describes an event") structure that describes how you want to be notified.

## Library:

- For the traditional implementation, libc:
    
    Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.
    
- For the alternate implementation that uses the [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) server and a queue in kernel space, libmq:
    
    Use the -l mq option to qcc to link against this library.
    

## Description:

If notification isn't NULL, the mq_notify() function asks the server to notify the calling process when the queue makes the transition from empty to nonempty. The means by which the server is to notify the process is passed in the [sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html "Structure that describes an event") structure pointed to by notification. Once the message queue server has notified the process of the transition, the notification is removed.

The message queue manager needs to be running. QNX Neutrino supports two implementations of message queues: a traditional implementation, and an alternate one that uses the mq server and a queue in kernel space. For more information, see the entries for [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) and [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html) in the Utilities Reference, as well as the [POSIX Message Queues: Two Implementations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html) technote.

We recommend that you use the following event types in this case:

- SIGEV_SIGNAL
- SIGEV_SIGNAL_CODE
- SIGEV_SIGNAL_THREAD
- SIGEV_PULSE

Under normal operation, only one process may register for notification at a time. If a process attempts to attach a notification, and another process is already attached, an error is returned and errno is set to EBUSY.

If a process has registered for notification, and another process is blocked on [mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html "Receive a message from a queue"), then the mq_receive() call is satisfied by any arriving message. The resulting behavior is as if the message queue remained empty.

If notification is NULL and the current process is currently registered for notification, then the existing registration is removed.

## Returns:

-1 if an error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set). Any other value indicates success.

## Errors:

### `EBADF`

Invalid message queue mqdes.

### `EBUSY`

A process has already registered for notification for the given queue.

### `EINVAL`

The notification argument is NULL, but the process isn't currently registered.

## Classification:

[POSIX 1003.1 MSG](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|No|
> |Thread|Yes|

### Related concepts  

[POSIX message queues (System Architecture)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Message_queues.html "POSIX message queues (System Architecture)")

[POSIX Message Queues: Two Implementations (Technotes)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html "POSIX Message Queues: Two Implementations (Technotes)")

### Related reference  

[ionotify()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/ionotify.html "Arm a resource manager")

[mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "Open a message queue")

[mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html "Receive a message from a queue")

[mq_send()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_send.html "Send a message to a queue")

[MsgRegisterEvent(), MsgRegisterEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgregisterevent.html "Register a secure event")

[sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html "Structure that describes an event")

[mq (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html "mq (Utilities Reference)")

[mqueue (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html "mqueue (Utilities Reference)")
