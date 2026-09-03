---
title: "Clock and timer services"
category: "Clock-and-timer-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, clock, timer]
---

# Clock and timer services

Clock services are used to maintain the time of day, which is in turn used by the kernel timer calls to implement interval timers.

Valid dates on a QNX Neutrino system range from January 1970 to at least 2038. The time_t data type is an unsigned 32-bit number, which extends this range for many applications through 2106. The kernel itself uses unsigned 64-bit numbers to count the nanoseconds since January 1970, and so can handle dates through 2554. If your system must operate past 2554 and there's no way for the system to be upgraded or modified in the field, you'll have to take special care with system dates (contact us for help with this).

The [ClockTime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clocktime.html) kernel call allows you to get or set the system clock specified by an ID (CLOCK_REALTIME), which maintains the system time. Once set, the system time increments by some number of nanoseconds based on the resolution of the system clock. This resolution can be queried or changed using the [ClockPeriod()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockperiod.html) call.

Within the _system page_, an in-memory data structure, there's a 64-bit field (nsec) that holds the number of nanoseconds since the system was booted. The nsec field is always monotonically increasing and is never affected by setting the current time of day via ClockTime() or [ClockAdjust()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockadjust.html).

The [ClockCycles()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockcycles.html) function returns the current value of a free-running 64-bit cycle counter. This is implemented on each processor as a high-performance mechanism for timing short intervals. For example, on Intel x86 processors, an opcode that reads the processor's time-stamp counter is used. Other CPU architectures have similar instructions.

On processors that don't implement such an instruction in hardware, the kernel will emulate one. This will provide a lower time resolution than if the instruction is provided (838.095345 nanoseconds on an IBM PC-compatible system).

In all cases, the SYSPAGE_ENTRY(qtime)->cycles_per_sec field gives the number of ClockCycles() increments in one second.

In QNX Neutrino 7.0 or later, we require that the hardware underlying ClockCycles() be synchronized across all processors on an SMP system. If it isn't, you might encounter some unexpected behavior, such as drifting times and timers.

The ClockPeriod() function allows a thread to set the system timer to some multiple of nanoseconds; the OS kernel will do the best it can to satisfy the precision of the request with the hardware available.

The interval selected is always rounded down to an integral of the precision of the underlying hardware timer. Of course, setting it to an extremely low value can result in a significant portion of CPU performance being consumed servicing timer interrupts.

The [ClockId()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockid.html) function returns a special clock ID that you can use to track the CPU time that a process or thread uses. For more information, see “[Monitoring execution times](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/timing_execution_times.html)” in the “Understanding the Microkernel's Concept of Time” chapter of the QNX Neutrino Programmer's Guide.

|Microkernel call|POSIX call|Description|
|---|---|---|
|[ClockTime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clocktime.html)|[clock_gettime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_gettime.html), [clock_settime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_settime.html)|Get or set the time of day (using a 64-bit value in nanoseconds ranging from 1970 to 2554)|
|[ClockAdjust()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockadjust.html)|N/A|Apply small time adjustments to synchronize clocks.|
|[ClockCycles()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockcycles.html)|N/A|Read a 64-bit free-running high-precision counter|
|[ClockPeriod()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockperiod.html)|[clock_getres()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getres.html)|Get or set the period of the clock|
|[ClockId()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockid.html)|[clock_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getcpuclockid.html), [pthread_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getcpuclockid.html)|Get a clock ID for a process or thread CPU-time clock|

The kernel can run in a _tickless_ mode in order to reduce power consumption, but this is a bit of a misnomer. The system still has clock ticks, and everything runs as normal unless the system is idle. Only when the system goes completely idle does the kernel turn off clock ticks, and in reality what it does is slow down the clock so that the next tick interrupt occurs just after the next active timer is to fire, so that the timer will fire immediately. To enable tickless operation, specify the -Z option for the startup-* code.

- **[Time correction](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Time_correction.html)**  
    
- **[Timers](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Timers.html)**  
    The QNX Neutrino RTOS directly provides the full set of POSIX timer functionality. Since these timers are quick to create and manipulate, they're an inexpensive resource in the kernel.

### Related concepts  

[Tick, Tock: Understanding the Microkernel's Concept of Time (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/timing.html "Tick, Tock: Understanding the Microkernel's Concept of Time (QNX Neutrino Programmer's Guide)")

[Clocks, Timers, and Getting a Kick Every So Often (Getting started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer.html "Clocks, Timers, and Getting a Kick Every So Often (Getting started with QNX Neutrino)")

### Related reference  

[asctime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/asctime.html "asctime()")

[ChannelCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html "ChannelCreate()")

[ClockAdjust()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockadjust.html "ClockAdjust()")

[ClockCycles()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockcycles.html "ClockCycles()")

[clock_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getcpuclockid.html "clock_getcpuclockid()")

[clock_getres()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getres.html "clock_getres()")

[clock_gettime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_gettime.html "clock_gettime()")

[ClockId()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockid.html "ClockId()")

[clock_nanosleep()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_nanosleep.html "clock_nanosleep()")

[ClockPeriod()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockperiod.html "ClockPeriod()")

[clock_settime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_settime.html "clock_settime()")

[ClockTime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clocktime.html "ClockTime()")

[ctime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/ctime.html "ctime()")

[delay()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/d/delay.html "delay()")

[mktime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mktime.html "mktime()")

[MsgReceive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "MsgReceive()")

[nanospin()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/n/nanospin.html "nanospin()")

[pthread_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getcpuclockid.html "pthread_getcpuclockid()")

[pthread_mutex_timedlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_timedlock.html "pthread_mutex_timedlock()")

[struct sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html "struct sigevent")

[sigwait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigwait.html "sigwait()")

[sleep()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sleep.html "sleep()")

[strftime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/strftime.html "strftime()")

[time()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/time.html "time()")

[timer_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timer_create.html "timer_create()")

[timer_settime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timer_settime.html "timer_settime()")

[TimerTimeout()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "TimerTimeout()")
