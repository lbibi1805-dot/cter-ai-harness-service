---
title: "clock_gettime()"
category: "Clock-and-timer-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, clock, timer]
---

# clock_gettime()
_Get the current time of a clock_

## Synopsis:

```c
#include <time.h>

int clock_gettime( clockid_t clock_id,
                   struct timespec * tp );
```

## Arguments:

**clock_id** —

The ID of the clock whose time you want to get; one of the following:

- CLOCK_REALTIME — the standard POSIX-defined clock. Timers based on this clock wake up the processor if it's in a power-saving mode.
- CLOCK_MONOTONIC — this clock always increases at a constant rate and can't be adjusted.
- CLOCK_PROCESS_CPUTIME_ID, CLOCK_THREAD_CPUTIME_ID, or a clock ID returned by [clock_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified process"), [pthread_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified thread"), or [ClockId()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockid.html "Get the CPU-time clock ID for a given process and thread"), representing the amount of time the process or thread has spent running. CLOCK_PROCESS_CPUTIME_ID and CLOCK_THREAD_CPUTIME_ID are special clock IDs that refer to the CPU time of the calling process and thread, respectively. See “[Monitoring execution times](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/timing_execution_times.html)” in the “Understanding the Microkernel's Concept of Time” chapter of the QNX Neutrino Programmer's Guide.

For more information about the different clocks, see “[Other clock sources](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer_otherclock.html)” in the “Clocks, Timers, and Getting a Kick Every So Often” chapter of Getting Started with QNX Neutrino.

**tp** —

A pointer to a [timespec](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timespec.html "Time-specification structure") structure where clock_gettime() can store the time. For CPU-time clocks, this time is the number of seconds and nanoseconds of execution time; for other clocks, this function sets the members as follows:

- tv_sec — the number of seconds since 1970.
- tv_nsec — the number of nanoseconds expired in the current second. This value increases by some multiple of nanoseconds, based on the system clock's resolution.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The clock_gettime() function gets the current time of the clock specified by clock_id, and puts it into the buffer pointed to by tp.

In order to get the time for a CPU-time clock associated with another process, your process must have the PROCMGR_AID_XPROCESS_QUERY ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

## Returns:

0

Success.

-1

An error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set).

## Errors:

### `EFAULT`

A fault occurred trying to access the buffers provided.

### `EINVAL`

Invalid clock_id.

### `EPERM`

The calling process doesn't have the required permission; see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

### `ESRCH`

The process associated with this request doesn't exist.

## Examples:

```c
/*
 * This program calculates the time required to
 * execute the program specified as its first argument.
 * The time is printed in seconds, on standard out.
 */
#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <time.h>

#define BILLION  1000000000L;

int main( int argc, char** argv )
  {
    struct timespec start, stop;
    double accum;

    if( clock_gettime( CLOCK_REALTIME, &start) == -1 ) {
      perror( "clock gettime" );
      return EXIT_FAILURE;
    }

    system( argv[1] );

    if( clock_gettime( CLOCK_REALTIME, &stop) == -1 ) {
      perror( "clock gettime" );
      return EXIT_FAILURE;
    }

    accum = ( stop.tv_sec - start.tv_sec )
             + (double)( stop.tv_nsec - start.tv_nsec )
               / (double)BILLION;
    printf( "%lf\n", accum );
    return EXIT_SUCCESS;
  }
```

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

[Clocks, Timers, and Getting a Kick Every So Often (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer.html "Clocks, Timers, and Getting a Kick Every So Often (Getting Started with QNX Neutrino)")

[Monitoring execution times (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/timing_execution_times.html "Monitoring execution times (Getting Started with QNX Neutrino)")

### Related reference  

[clock_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified process")

[clock_getres()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getres.html "Get the resolution of the clock")

[clock_settime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_settime.html "Set a clock")

[ClockId(), ClockId_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockid.html "Get the CPU-time clock ID for a given process and thread")

[ClockTime(), ClockTime_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clocktime.html "Get or set a clock")

[errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable")

[pthread_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified thread")

[timespec](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timespec.html "Time-specification structure")

[timespec_get()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timespec_get.html "Get the number of seconds and nanoseconds since a given epoch")
