---
title: "pthread_getcpuclockid()"
category: "Clock-and-timer-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, clock, timer]
---

# pthread_getcpuclockid()
_Return the clock ID of the CPU-time clock from a specified thread_

## Synopsis:

```c
#include <sys/types.h>
#include <time.h>
#include <pthread.h>

int pthread_getcpuclockid( pthread_t id,
                           clockid_t* clock_id);
```

## Arguments:

**thread** —

The ID of the thread that you want to get the clock ID for, which you can get when you call [pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html "Create a thread") or [pthread_self()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_self.html "Get the calling thread's ID").

**clock_id** —

A pointer to a clockid_t object where the function can store the clock ID.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_getcpuclockid() function gets the clock ID of the CPU-time clock of the thread specified by id (if the thread exists) and stores the clock ID in the object that clock_id points to. The CPU-time clock represents the amount of time the thread has spent running. For more information, see “[Monitoring execution times](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/timing_execution_times.html)” in the “Understanding the Microkernel's Concept of Time” chapter of the QNX Neutrino RTOS Programmer's Guide.

## Returns:

0

Success.

### `ESRCH`

The value specified by id doesn't refer to an existing thread.

## Examples:

```c
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <errno.h>
#include <pthread.h>

int main( int argc, const char *argv[] )
{
    clockid_t clk_id;
    struct timespec tspec;
    pthread_t tid;

    tid = pthread_self();

    if (pthread_getcpuclockid( tid, &clk_id) == 0)
    {
        if (clock_gettime( clk_id, &tspec ) != 0)
        {
            perror ("clock_gettime():");
        }
        else
        {
            printf ("CPU time for tid %d is %d seconds, %ld nanoseconds.\n",
                    tid, tspec.tv_sec, tspec.tv_nsec);
        }
    }
    else
    {
        printf ("pthread_getcpuclockid(): no thread with ID %d.\n", tid);
    }

    return EXIT_SUCCESS;
}
```

## Classification:

[POSIX 1003.1 TCT](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Clocks, Timers, and Getting a Kick Every So Often (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer.html "Clocks, Timers, and Getting a Kick Every So Often (Getting Started with QNX Neutrino)")

[Monitoring execution times (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/timing_execution_times.html "Monitoring execution times (Getting Started with QNX Neutrino)")

### Related reference  

[clock_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified process")

[clock_getres()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getres.html "Get the resolution of the clock")

[clock_gettime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_gettime.html "Get the current time of a clock")

[ClockId(), ClockId_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockid.html "Get the CPU-time clock ID for a given process and thread")

[clock_settime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_settime.html "Set a clock")

[timer_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timer_create.html "Create a timer")
