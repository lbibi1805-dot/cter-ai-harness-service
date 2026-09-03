---
title: "pthread_attr_setschedparam()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_attr_setschedparam()
_Set a thread's scheduling parameters attribute_

## Synopsis:

```c
#include <pthread.h>
#include <sched.h>

int pthread_attr_setschedparam(
            pthread_attr_t * attr,
            const struct sched_param * param );
```

## Arguments:

**attr** —

A pointer to the pthread_attr_t structure that defines the attributes to use when creating new threads. For more information, see [pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object").

**param** —

A pointer to a [sched_param](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sched_param.html "Structure that describes scheduling parameters") structure that defines the thread's scheduling parameters.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_attr_setschedparam() function sets the thread scheduling parameters attribute in the thread attribute object attr to param.

The thread scheduling parameters are used only if you've set the thread inherit scheduling attribute to PTHREAD_EXPLICIT_SCHED by calling [pthread_attr_setinheritsched()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setinheritsched.html "Set the thread's inherit-scheduling attribute"). By default, a thread inherits its parent's priority.

In order to create a thread whose priority is above the maximum permitted for unprivileged processes, your process must have the PROCMGR_AID_PRIORITY ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

## Returns:

### `EOK`

Success.

### `EINVAL`

In the sched_param structure, sched_ss_repl_period is less than sched_ss_init_budget, or sched_ss_max_repl is not in the inclusive range of 1 to SS_REPL_MAX.

## Examples:

See the entry for [sched_param](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sched_param.html#sched_param__Examples).

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

### Related concepts  

[Thread scheduling (System Architecture)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_SCHEDULING.html "Thread scheduling (System Architecture)")

[Scheduling policies (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/overview_SCHEDS.html "Scheduling policies (QNX Neutrino Programmer's Guide)")

[Processes and Threads (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs.html "Processes and Threads (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_attr_getschedparam()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getschedparam.html "Get the thread scheduling parameters attribute")

[pthread_attr_setinheritsched()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setinheritsched.html "Set the thread's inherit-scheduling attribute")

[pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object")

[pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html "Create a thread")

[sched_param](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sched_param.html "Structure that describes scheduling parameters")
