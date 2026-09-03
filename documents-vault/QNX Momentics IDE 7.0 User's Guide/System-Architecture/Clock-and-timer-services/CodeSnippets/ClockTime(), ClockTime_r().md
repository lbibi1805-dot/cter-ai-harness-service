---
title: "ClockTime(), ClockTime_r()"
category: "Clock-and-timer-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, clock, timer]
---

# ClockTime(), ClockTime_r()

_Get or set a clock_

## Synopsis:

```c
#include <sys/neutrino.h>

int ClockTime( clockid_t id,
               const uint64_t * new,
               uint64_t * old );

int ClockTime_r( clockid_t id,
                 const uint64_t * new,
                 uint64_t * old );
```

## Arguments:

**id** —

The clock ID; one of the following:

- CLOCK_REALTIME or CLOCK_MONOTONIC, which are the IDs of the clocks that maintain the system time
- CLOCK_PROCESS_CPUTIME_ID, CLOCK_THREAD_CPUTIME_ID, or a clock ID returned by [clock_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified process"), [pthread_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified thread"), or [ClockId()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockid.html "Get the CPU-time clock ID for a given process and thread"), representing the amount of time the process or thread has spent actually running. CLOCK_PROCESS_CPUTIME_ID and CLOCK_THREAD_CPUTIME_ID are special clock IDs that refer to the CPU time of the calling process and thread, respectively. See “[Monitoring execution times](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/timing_execution_times.html)” in the “Understanding the Microkernel's Concept of Time” chapter of the QNX Neutrino Programmer's Guide.

For more information about the different clocks, see “[Other clock sources](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer_otherclock.html)” in the Clocks, Timers, and Getting a Kick Every So Often of Getting Started with QNX Neutrino.

**new** —

NULL, or a pointer to the absolute time, in nanoseconds, to set the clock to. This is used only if id is CLOCK_REALTIME.

**old** —

NULL, or a pointer to a location where the function can store the current time (before being changed by a non-NULL new).

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

You can use these kernel calls to:

- get or set the system clock if id is CLOCK_REALTIME
- get the system clock if id is CLOCK_MONOTONIC
- get the CPU-time clock for a process or a particular thread in a process, if the ID is one that you obtained by calling [ClockId()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockid.html "Get the CPU-time clock ID for a given process and thread"). On an SMP box, the time for a process may exceed the realtime number of nanoseconds that have elapsed because threads in the process can run on different CPUs at the same time.

The ClockTime() and ClockTime_r() functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clocktime.html#clocktime__Returns) section for details.

Instead of using these kernel calls directly, consider calling [clock_gettime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_gettime.html "Get the current time of a clock") or [clock_settime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_settime.html "Set a clock").

If new isn't NULL, then it contains the absolute time, in nanoseconds, to set the system clock to. This affects the software clock maintained by the system. It doesn't change any underlying hardware clock that maintains the time when the system's power is turned off.

- In order to get the time for a CPU-time clock associated with another process, your process must have the PROCMGR_AID_XPROCESS_QUERY ability enabled.
- You can set the time only when the id is CLOCK_REALTIME. In order to set the clock, your process must have the PROCMGR_AID_CLOCKSET ability enabled.

For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

If you call ClockTime() to set the time of day, the kernel checks to see if the SYSPAGE_ENTRY(qtime)->boot_time field is zero. If it is, the kernel sets it to the appropriate value. There's a -T option for all startup programs that prevents the setting of this field, so that the kernel will set it the first time you call ClockTime() to change the time of day. This is useful if the RTC hardware isn't in UTC.

Once set, the system time increments by some number of nanoseconds, based on the resolution of the system clock. You can query or change this resolution by using the [ClockPeriod()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockperiod.html "Get or set a clock period") kernel call.

If you change the time for CLOCK_REALTIME, the change occurs immediately, and the expiry time for some timers might end up in the past. In this case, the timers will expire on the next clock tick. If you need the affected timers to expire before the next clock tick, then before changing the time, set a high-resolution timer to expire just after the new time; after you change the time, the high-resolution timer will expire and so will all the affected timers.

**Blocking states**

These calls don't block.

## Returns:

The only difference between these functions is the way they indicate errors:

ClockTime()

If an error occurs, the function returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable"). Any other value returned indicates success.

ClockTime_r()

EOK is returned on success. This function does **NOT** set errno. If an error occurs, the function returns a value in the Errors section.

## Errors:

### `EFAULT`

A fault occurred when the kernel tried to access the buffers provided.

### `EINVAL`

The clock ID isn't valid, or you tried to set the time for an ID other than CLOCK_REALTIME.

### `EPERM`

One of the following occurred:

- The calling process doesn't have the required permission; see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").
- You tried to set the time for a process or thread CPU-time clock.

### `ESRCH`

The process associated with this request doesn't exist.

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

### Related concepts  

[Clocks, Timers, and Getting a Kick Every So Often (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer.html "Clocks, Timers, and Getting a Kick Every So Often (Getting Started with QNX Neutrino)")

[Monitoring execution times (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/timing_execution_times.html "Monitoring execution times (Getting Started with QNX Neutrino)")

### Related reference  

[clock_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified process")

[clock_gettime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_gettime.html "Get the current time of a clock")

[clock_settime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_settime.html "Set a clock")

[ClockAdjust(), ClockAdjust_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockadjust.html "Adjust the time of a clock")

[ClockId(), ClockId_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockid.html "Get the CPU-time clock ID for a given process and thread")

[ClockPeriod(), ClockPeriod_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockperiod.html "Get or set a clock period")

[procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")

[SYSPAGE_ENTRY()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syspage_entry.html "Return an entry from the system page")

[pthread_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified thread")
