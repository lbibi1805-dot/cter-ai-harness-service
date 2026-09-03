---
title: "pthread_attr_init()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_attr_init()
_Initialize a thread-attribute object_

## Synopsis:

```c
#include <pthread.h>

int pthread_attr_init( pthread_attr_t *attr );
```

## Arguments:

**attr** —

A pointer to the pthread_attr_t structure that you want to initialize. For more information, see below.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_attr_init() function initializes the thread attributes in the thread attribute object attr to their default values:

- Cancellation requests may be acted on according to the cancellation type (PTHREAD_CANCEL_DEFERRED).
- Cancellation requests are held pending until a cancellation point (PTHREAD_CANCEL_ENABLE).
- Threads are put into a zombie state when they terminate, and they stay in this state until you retrieve their exit status or detach them (PTHREAD_CREATE_JOINABLE).
- Threads inherit the scheduling policy of their parent thread (PTHREAD_INHERIT_SCHED).
- Threads are scheduled against all threads in the system (PTHREAD_SCOPE_SYSTEM).
- The stack attributes are set so that the kernel will allocate a 4 KB stack for new threads and free the stacks when the threads terminate.
- When threads are created, they aren't put into a suspended state (PTHREAD_CREATE_NOT_SUSPENDED).

After initialization, you can use the pthread_attr_* family of functions to get and set the attributes:

|Get|Set|
|---|---|
|[pthread_attr_getdetachstate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getdetachstate.html "Get the thread detach state attribute")|[pthread_attr_setdetachstate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setdetachstate.html "Set the thread detach state attribute")|
|[pthread_attr_getguardsize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getguardsize.html "Get the size of the thread's guard area")|[pthread_attr_setguardsize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setguardsize.html "Set the size of the thread's guard area")|
|[pthread_attr_getinheritsched()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getinheritsched.html "Get a thread's inherit-scheduling attribute")|[pthread_attr_setinheritsched()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setinheritsched.html "Set the thread's inherit-scheduling attribute")|
|[pthread_attr_getschedparam()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getschedparam.html "Get the thread scheduling parameters attribute")|[pthread_attr_setschedparam()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setschedparam.html "Set a thread's scheduling parameters attribute")|
|[pthread_attr_getschedpolicy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getschedpolicy.html "Get the thread scheduling policy attribute")|[pthread_attr_setschedpolicy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setschedpolicy.html "Set the thread scheduling policy attribute")|
|[pthread_attr_getscope()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getscope.html "Get the thread contention scope attribute")|[pthread_attr_setscope()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setscope.html "Set the thread contention scope attribute")|
|[pthread_attr_getstack()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstack.html "Get the thread-creation stack attributes")|[pthread_attr_setstack()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstack.html "Set the thread-creation stack attributes")|
|[pthread_attr_getstackaddr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstackaddr.html "Get the thread stack address attribute")|[pthread_attr_setstackaddr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstackaddr.html "Set the thread stack address attribute")|
|[pthread_attr_getstacklazy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstacklazy.html "Get the thread lazy-stack attribute")|[pthread_attr_setstacklazy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstacklazy.html "Set the thread lazy-stack attribute")|
|[pthread_attr_getstackprealloc()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstackprealloc.html "Get the amount of memory to preallocate for a thread's MAP_LAZY stack")|[pthread_attr_setstackprealloc()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstackprealloc.html "Set the amount of memory to preallocate for a thread's MAP_LAZY stack")|
|[pthread_attr_getstacksize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstacksize.html "Get the thread stack-size attribute")|[pthread_attr_setstacksize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstacksize.html "Set the thread stack-size attribute")|
|[pthread_attr_getsuspendstate_np()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getsuspendstate_np.html "Get the thread suspend state attribute")|[pthread_attr_setsuspendstate_np()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setsuspendstate_np.html "Set the thread suspend state attribute")|

You can also set some non-POSIX attributes; for more information, see “[QNX Neutrino extensions](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html#pthread_create__QNXExtensions),” in the documentation for pthread_create().

You can then pass the attribute object to [pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html "Create a thread") to create a thread with the required attributes. You can use the same attribute object in multiple calls to pthread_create().

The effect of initializing an already-initialized thread-attribute object is undefined.

## Returns:

### `EOK`

Success.

## Classification:

[POSIX 1003.1](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related reference  

[pthread_attr_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_destroy.html "Destroy a thread-attribute object")

[pthread_attr_getdetachstate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getdetachstate.html "Get the thread detach state attribute")

[pthread_attr_getguardsize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getguardsize.html "Get the size of the thread's guard area")

[pthread_attr_getinheritsched()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getinheritsched.html "Get a thread's inherit-scheduling attribute")

[pthread_attr_getschedparam()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getschedparam.html "Get the thread scheduling parameters attribute")

[pthread_attr_getschedpolicy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getschedpolicy.html "Get the thread scheduling policy attribute")

[pthread_attr_getscope()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getscope.html "Get the thread contention scope attribute")

[pthread_attr_getstack()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstack.html "Get the thread-creation stack attributes")

[pthread_attr_getstackaddr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstackaddr.html "Get the thread stack address attribute")

[pthread_attr_getstacklazy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstacklazy.html "Get the thread lazy-stack attribute")

[pthread_attr_getstackprealloc()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstackprealloc.html "Get the amount of memory to preallocate for a thread's MAP_LAZY stack")

[pthread_attr_getstacksize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstacksize.html "Get the thread stack-size attribute")

[pthread_attr_getsuspendstate_np()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getsuspendstate_np.html "Get the thread suspend state attribute")

[pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object")

[pthread_attr_setdetachstate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setdetachstate.html "Set the thread detach state attribute")

[pthread_attr_setguardsize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setguardsize.html "Set the size of the thread's guard area")

[pthread_attr_setinheritsched()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setinheritsched.html "Set the thread's inherit-scheduling attribute")

[pthread_attr_setschedparam()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setschedparam.html "Set a thread's scheduling parameters attribute")

[pthread_attr_setschedpolicy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setschedpolicy.html "Set the thread scheduling policy attribute")

[pthread_attr_setscope()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setscope.html "Set the thread contention scope attribute")

[pthread_attr_setstack()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstack.html "Set the thread-creation stack attributes")

[pthread_attr_setstackaddr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstackaddr.html "Set the thread stack address attribute")

[pthread_attr_setstacklazy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstacklazy.html "Set the thread lazy-stack attribute")

[pthread_attr_setstackprealloc()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstackprealloc.html "Set the amount of memory to preallocate for a thread's MAP_LAZY stack")

[pthread_attr_setstacksize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstacksize.html "Set the thread stack-size attribute")

[pthread_attr_setsuspendstate_np()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setsuspendstate_np.html "Set the thread suspend state attribute")

[pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html "Create a thread")
