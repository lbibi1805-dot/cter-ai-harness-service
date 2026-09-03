---
title: "clock_settime()"
category: "Clock-and-timer-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, clock, timer]
---

# clock_settime()
_Set a clock_

## Synopsis:

```c
#include <time.h>

int clock_settime( clockid_t id,
                   const struct timespec * tp );
```

## Arguments:

**id** —

CLOCK_REALTIME, the ID of the clock that maintains the system time.

For more information about the different clocks, see “[Other clock sources](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer_otherclock.html)” in the Clocks, Timers, and Getting a Kick Every So Often of Getting Started with QNX Neutrino.

**tp** —

A pointer to a [timespec](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timespec.html "Time-specification structure") structure containing at least the following members:

- tv_sec — the number of seconds since 1970.
- tv_nsec — the number of nanoseconds in the current second. This value increases by some multiple of nanoseconds, based on the system clock's resolution.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The clock_settime() function sets the clock specified by id to the time specified in the buffer pointed to by tp.

- Be careful if you set the date during the period that a time zone is switching from daylight saving time (DST) to standard time. When a time zone changes to standard time, the local time goes back one hour (for example, 2:00 a.m. becomes 1:00 a.m.). The local time during this hour is ambiguous (e.g., 1:14 a.m. occurs twice in the morning that the time zone switches to standard time). To avoid problems, use UTC time to set the date in this period.
- You can't set the time when the id is CLOCK_MONOTONIC.
- In order to set the clock, your process must have the PROCMGR_AID_CLOCKSET ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

If you change the time for CLOCK_REALTIME, the change occurs immediately, and the expiry time for some timers might end up in the past. In this case, the timers will expire on the next clock tick. If you need the affected timers to expire before the next clock tick, then before changing the time, set a high-resolution timer to expire just after the new time; after you change the time, the high-resolution timer will expire and so will all the affected timers.

## Returns:

0

**Success** —

-1

An error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set).

## Errors:

### `EINVAL`

One of the following occurred:

- The id is invalid. You can't set the time for CLOCK_MONOTONIC.
- The number of nanoseconds specified by the tv_nsec member is less than zero or greater than or equal to 1000 million.
- The tv_sec member is -1 (which could happen if you set it to the result from [mktime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mktime.html "Convert local time to calendar time") without checking to see if the call succeeded).

### `EPERM`

One of the following occurred:

- The calling process doesn't have the required permission; see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").
- You tried to set the time for a process or thread CPU-time clock.

## Examples:

```c
/*  This program sets the clock forward 1 day. */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <time.h>

int main( void )
  {
    struct timespec stime;

    if( clock_gettime( CLOCK_REALTIME, &stime) == -1 ) {
       perror( "getclock" );
       return EXIT_FAILURE;
    }

    stime.tv_sec += (60*60)*24L;  /* Add one day */
    stime.tv_nsec = 0;
    if( clock_settime( CLOCK_REALTIME, &stime) == -1 ) {
       perror( "setclock" );
       return EXIT_FAILURE;
    }
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

### Related reference  

[clock_getres()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getres.html "Get the resolution of the clock")

[clock_gettime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_gettime.html "Get the current time of a clock")

[ClockTime(), ClockTime_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clocktime.html "Get or set a clock")

[errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable")

[mktime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mktime.html "Convert local time to calendar time")

[procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")

[timespec](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timespec.html "Time-specification structure")
