---
title: "MsgDeliverEvent(), MsgDeliverEvent_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# MsgDeliverEvent(), MsgDeliverEvent_r()
_Deliver an event through a channel_

## Synopsis:

```c
#include <sys/neutrino.h>

int MsgDeliverEvent( int rcvid,
                     const struct sigevent* event );

int MsgDeliverEvent_r( 
                   int rcvid,
                   const struct sigevent* event );
```

## Arguments:

**rcvid** —

The value returned to the server when it receives a message from a client using MsgReceive*(), or 0 to deliver the event to the active thread (see below).

**event** —

A pointer to a [sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html "Structure that describes an event") structure that contains the event you want to send. These events are defined in <sys/siginfo.h>. The type of event is placed in event.sigev_notify.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The MsgDeliverEvent() and MsgDeliverEvent_r() kernel calls deliver an event from a server to a client through a channel connection. They're typically used to perform async IO and async event notification to clients that don't want to block on a server.

These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgdeliverevent.html#msgdeliverevent__Returns) section for details.

Although the server can explicitly send any event it desires, it's more typical for the server to receive a struct sigevent in a message from the client that already contains this data. The message also contains information for the server indicating the conditions on when to notify the client with the event. The server then saves the rcvid from MsgReceive*() and the event from the message without needing to examine the event in any way. When the trigger conditions are met in the server, such as data becoming available, the server calls MsgDeliverEvent() with the saved rcvid and event.

In QNX Neutrino 7.0.1 or later, the sigevent can contain the handle for a secure event that the client registered by calling [MsgRegisterEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgregisterevent.html "Register a secure event"). For more information, see “[Events](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Events.html)” in the “Interprocess Communication (IPC)” chapter of the System Architecture guide.

You can use the SIGEV_SIGNAL set of notifications to create an asynchronous design in which the client is interrupted when the event occurs. The client can make this synchronous by using the [SignalWaitinfo()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalwaitinfo.html "Select a pending signal") kernel call to wait for the signal. Where possible, you should use an event-driven synchronous design that's based on SIGEV_PULSE. In this case, the client sends messages to servers, and requests event notification via a pulse.

The notify types of SIGEV_UNBLOCK and SIGEV_INTR are allowed, but aren't very useful with MsgDeliverEvent(). SIGEV_UNBLOCK is typically used by the TimerTimeout() kernel call, and SIGEV_INTR is typically used with the InterruptWait() kernel call.

You should use MsgDeliverEvent() when two processes need to communicate with each other without the possibility of deadlock. The blocking nature of MsgSend*() introduces a hierarchy of processes in which “sends” flow one way and “replies” the other way.

In the following diagram, processes at the A level can send to processes at the B or C level. Processes at the B level can send to the C level but they should never send to the A level. Likewise, processes at the C level can never send to those at the A or B level. To A, B and C are servers. To B, A is a client and C is a server.

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/images/msgsendpulse1.png) Figure 1. A hierarchy of processes.

These hierarchies are simple to establish and ensure a clean deadlock-free design. If these rules are broken then deadlock can occur as shown below:

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/images/msgsendpulse2.png) Figure 2. A deadlock when sending messages improperly among processes.

There are common situations which require communication to flow backwards through the hierarchy. For example, A sends to B requesting notification when data is available. B immediately replies to A. At some point in the future, B will have the data A requested and will inform A. B can't send a message to A because this might result in deadlock if A decided to send to B at the same time.

The solution is to have B use a nonblocking MsgDeliverEvent() to inform A. A receives this pulse and sends a message to B requesting the data. B then replies with the data. This is the basis for asynchronous IO. Clients send to servers and where necessary, servers use pulses to request clients to resend to them as needed. This is illustrated below:

|Message|Use|
|---|---|
|A sends to B|Async IO request|
|B replies to A|Request acknowledged|
|B sends pulse to A|Requested data available|
|A sends to B|Request for the data|
|B replies to A|Reply with data|

In client/server designs, you typically use MsgDeliverEvent() in the server, and [MsgSendPulse()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulse.html "Send a pulse to a process") in the client.

Sometimes it might be convenient for a library that doesn't have the rcvid to deliver the event instead of handing it off to the server. The library could interpret the sigevent itself, but this duplicates what the kernel already knows how to do. Instead, the library can call MsgDeliverEvent() with a rcvid of 0. The kernel then creates an artificial rcvid that references the calling thread—as if a server had received the message from it via MsgReceive()—and then the rest of the MsgDeliverEvent() proceeds normally.

If the client program replaces its process image (e.g., by calling [exec*()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/lib-e.html)) with a setuid or setgid binary, the kernel sets the _NTO_COF_INSECURE flag on the channel. If this flag is set, calls to MsgDeliverEvent() with an event type of SIGEV_MEMORY or SIGEV_THREAD fail with an error of EACCES. In QNX Neutrino 7.0 and later, only the kernel can clear this flag; currently it stays set until the connection is detached.

MsgDeliverEvent() checks the event before delivering it, and uses the error codes listed below to indicate any problems found. For SIGEV_PULSE events, the priority of the pulse must be in the range for the target process, or (in QNX Neutrino 6.6 or later) that process must have the PROCMGR_AID_PRIORITY ability enabled (see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")). In QNX Neutrino 6.6 or later, if [procnto](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/p/procnto.html) was started with an “s” appended to the -P option, then out-of-range priority requests use the maximum allowed value instead of resulting in an error.

**Blocking states**

None for the local case. In the network case:

STATE_REPLY

The calling thread is waiting for a network operation to complete. The calling thread is marked as REPLY-blocked on itself (the same process ID as the thread making the call).

**Native networking**

When you use MsgDeliverEvent() to communicate across a network, the return code isn't “reliable”. In the local case, MsgDeliverEvent() always returns a correct success or failure value. But since MsgDeliverEvent() _must be nonblocking_, in the networked case, the return value isn't guaranteed to reflect the actual result on the client's node. This is because MsgDeliverEvent() would have to block waiting for the communications between the two lsm-qnet.so objects.

Generally, this isn't a problem, because MsgDeliverEvent() is for the benefit of the client anyway—if the client no longer exists, then the client obviously doesn't care that it didn't get the event. The server usually delivers the event and then goes about its business, regardless of the success or failure of the event delivery.

## Returns:

The only difference between these functions is the way they indicate errors:

MsgDeliverEvent()

If an error occurs, this function returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable"). Any other value returned indicates success.

MsgDeliverEvent_r()

If successful, this function returns EOK. This function does **NOT** set errno, even on success. If an error occurs, it may return any value from the Errors section.

## Errors:

### `EACCES`

One of the following occurred:

- The _NTO_COF_INSECURE flag is set on the channel. In QNX Neutrino 7.0 and later, only the kernel can clear this flag.
- (QNX Neutrino 7.0 or later) The _NTO_COF_NOEVENT flag is set on the channel.
- (QNX Neutrino 7.0.1 or later) The [sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html "Structure that describes an event") isn't an event handle, and the client set _NTO_COF_REG_EVENTS on the connection to indicate that it accepts only sigevents that were registered as secure events with [MsgRegisterEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgregisterevent.html "Register a secure event").
- The target process's threads are being destroyed.

### `EAGAIN`

The kernel has insufficient resources to enqueue the event.

### `EBADF`

The thread indicated by rcvid had its connection detached.

### `EBUSY`

The event type is SIGEV_THREAD and the target process's threads are being destroyed or a core dump is being created for the target process.

### `ECANCELED`

The event couldn't be queued.

### `EFAULT`

A fault occurred when the kernel tried to access the buffers provided.

### `EINVAL`

The given event isn't valid; for example, the type of notification might be invalid. Other meanings depend on the type of notification, and include:

- SIGEV_MEMORY: the memory operation specified by sigev_memop isn't valid.
- SIGEV_PULSE: the priority is out of range.
- SIGEV_SIGNAL: the signal is out of range.
- SIGEV_SIGNAL_CODE, SIGEV_SIGNAL_THREAD: the signal or the sigev_code is out of range.

### `ENXIO`

The process that's supposed to receive a pulse is terminating.

### `EPERM`

For SIGEV_PULSE events, the priority of the pulse is outside the range for nonprivileged processes, and the target process doesn't have the PROCMGR_AID_PRIORITY ability enabled (see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")).

### `ESRCH`

The thread indicated by rcvid doesn't exist.

### `ESRVRFAULT`

A fault occurred in the server's address space when the kernel tried to write the pulse message to the server's receive message buffer (SIGEV_PULSE only).

### `ETIMEDOUT`

A kernel timeout unblocked the call. See [TimerTimeout()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state").

## Examples:

```c
The following example demonstrates how a client can request a server to notify it with a pulse at a later time (in this case, after the server has slept for two seconds). The server side notifies the client using MsgDeliverEvent().

Here's the header file that's used by client.c and server.c:

struct my_msg
{
   short type;
   struct sigevent event;
};

#define MY_PULSE_CODE _PULSE_CODE_MINAVAIL+5
#define MSG_GIVE_PULSE _IO_MAX+4
#define MY_SERV "my_server_name"

Here's the client side that fills in a struct sigevent and then receives a pulse:

/* client.c */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <errno.h>
#include <sys/neutrino.h>
#include <sys/iomsg.h>

#include "my_hdr.h"

int main( int argc, char **argv)
{
  int chid, coid, srv_coid, rcvid;
  struct my_msg msg;
  struct _pulse pulse;

  /* we need a channel to receive the pulse notification on */
  chid = ChannelCreate( 0 ); 

  /* and we need a connection to that channel for the pulse to be
     delivered on */
  coid = ConnectAttach( 0, 0, chid, _NTO_SIDE_CHANNEL, 0 );

  /* fill in the event structure for a pulse */
  SIGEV_PULSE_INIT( &msg.event, coid, SIGEV_PULSE_PRIO_INHERIT, 
                    MY_PULSE_CODE, 0 );
  msg.type = MSG_GIVE_PULSE;

  /* find the server */
  if ( (srv_coid = name_open( MY_SERV, 0 )) == -1)
  {
     printf("failed to find server, errno %d\n", errno );
     exit(1);
  }

  /* give the pulse event we initialized above to the server for
     later delivery */
  MsgSend( srv_coid, &msg, sizeof(msg), NULL, 0 );

  /* wait for the pulse from the server */
  rcvid = MsgReceivePulse( chid, &pulse, sizeof( pulse ), NULL );
  printf("got pulse with code %d, waiting for %d\n", pulse.code, 
         MY_PULSE_CODE );

  return 0;
}

Here's the server side that delivers the pulse defined by the struct sigevent:

/* server.c */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <errno.h>
#include <sys/neutrino.h>
#include <sys/iomsg.h>
#include <sys/iofunc.h>
#include <sys/dispatch.h>

#include "my_hdr.h"

int main(int argc, char **argv) {
  int             rcvid;
  union {
      struct my_msg   mine;
      struct _pulse   pulse;
  }           msg;
  name_attach_t  *attach;

  /* Attach the name the client will use to find us. */
  /* Our channel will be in the attach structure */
  if ((attach = name_attach(NULL, MY_SERV, 0)) == NULL) {
     printf("server:failed to attach name, errno %d\n", errno);
     exit(1);
  }

  /* Wait for the message from the client. */
  for( ;; ) {
     rcvid = MsgReceive(attach->chid, &msg, sizeof(msg), NULL);
     switch(msg.mine.type) {
        case _PULSE_CODE_DISCONNECT:
           ConnectDetach(msg.pulse.scoid);
           break;
        case _IO_CONNECT:   
           MsgReply(rcvid, 0, NULL, 0);
           break;
        case MSG_GIVE_PULSE:    
           /* Wait until it is time to notify the client */
           sleep(2);

           /*
            * Deliver notification to client that client
            * requested
            */
           MsgDeliverEvent(rcvid, &msg.mine.event);
           printf("server:delivered event\n");
           return 0;
        default:    
           printf("server: unexpected message %d\n", msg.mine.type);
           return 0;
     }
  }

  return 0;
}
```

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

## Caveats:

In the case of a pulse event, if the server faults on delivery, the pulse is either lost or an error is returned.

### Related concepts  

[Message Passing (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_msg.html "Message Passing (Getting Started with QNX Neutrino)")

[Events (System Architecture)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Events.html "Events (System Architecture)")

### Related reference  

[MsgReceive(), MsgReceive_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "Wait for a message or pulse on a channel")

[MsgReceivev(), MsgReceivev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "Wait for a message or pulse on a channel")

[MsgRegisterEvent(), MsgRegisterEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgregisterevent.html "Register a secure event")

[MsgSend(), MsgSend_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "Send a message to a channel")

[MsgSendPulse(), MsgSendPulse_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulse.html "Send a pulse to a process")

[MsgSendPulsePtr(), MsgSendPulsePtr_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulseptr.html "Send a pulse (containing a pointer) to a process")

[MsgSendv(), MsgSendv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendv.html "Send a message to a channel")

[MsgUnregisterEvent(), MsgUnregisterEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgunregisterevent.html "Unregister a secure event")

[MsgVerifyEvent(), MsgVerifyEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgverifyevent.html "Check the validity of a receive ID and an event configuration")

[sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html "Structure that describes an event")

[SignalWaitinfo(), SignalWaitinfo_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalwaitinfo.html "Select a pending signal")

[SignalWaitinfoMask(), SignalWaitinfoMask_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalwaitinfomask.html "Block a set of signals and then select a pending signal")
