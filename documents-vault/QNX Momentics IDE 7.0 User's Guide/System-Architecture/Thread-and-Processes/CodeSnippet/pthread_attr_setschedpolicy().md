---
title: "pthread_attr_setschedpolicy()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_attr_setschedpolicy()
_Set the thread scheduling policy attribute_

## Synopsis:

```c
#include <pthread.h>
#include <sched.h>

int pthread_attr_setschedpolicy(
                 pthread_attr_t* attr,
                 int policy );
```

## Arguments:

**attr** —

A pointer to the pthread_attr_t structure that defines the attributes to use when creating new threads. For more information, see [pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object").

**policy** —

The new value for the scheduling policy:

- SCHED_FIFO — first-in first-out scheduling.
- SCHED_RR — round-robin scheduling.
- SCHED_OTHER — currently the same as SCHED_RR.
- SCHED_NOCHANGE — don't change the policy.
- SCHED_SPORADIC — sporadic scheduling.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_attr_setschedpolicy() function sets the thread scheduling policy attribute in the thread attribute object attr to policy.

The policy attribute is used only if you've set the thread inherit-scheduling attribute to PTHREAD_EXPLICIT_SCHED by calling [pthread_attr_setinheritsched()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setinheritsched.html "Set the thread's inherit-scheduling attribute").

For descriptions of the scheduling policies, see “[Scheduling policies](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_SchedulingAlgorithms.html)” in the chapter on the microkernel in the System Architecture guide.

## Returns:

### `EOK`

Success.

### `EINVAL`

Invalid thread-scheduling policy policy.

## Classification:

[POSIX 1003.1 TPS](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Thread scheduling (System Architecture)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_SCHEDULING.html "Thread scheduling (System Architecture)")

[Scheduling policies (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/overview_SCHEDS.html "Scheduling policies (QNX Neutrino Programmer's Guide)")

[Processes and Threads (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs.html "Processes and Threads (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_attr_getschedpolicy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getschedpolicy.html "Get the thread scheduling policy attribute")

[pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object")

[pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html "Create a thread")
