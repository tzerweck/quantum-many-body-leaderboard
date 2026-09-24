"""What a cost run's hardware was doing while it ran (protocol v1.4, Tristan 2026-09-24).

The same DMRG rung took 3.4 core-h on one Euler node and 8.7 on another. Slurm pins a job to
its own cores, so the difference is in what the cores share: clock (boost falls as the socket
fills), memory bandwidth and L3. Every results file therefore records, next to the wall-clock:

- the process's own CPU time (user + system, all threads), and CPU time / (wall x cores): near 1
  means the cores were busy and any slowness is per instruction (clock, memory), well below 1
  means the process waited;
- the clock of the cores the process may run on, sampled every 30 s from the kernel;
- the node's load average against its core count (other jobs, which the account cannot list);
- for a GPU run, the GPU's SM clock, utilisation and power, sampled the same way.

    from monitor import Monitor
    MON = Monitor()          # at process start; samples in a daemon thread
    ...
    MON.summary()            # a dict for the results file, at any point (cumulative)
"""
import os
import resource
import subprocess
import threading
import time

PERIOD = 30.0


def _cores():
    try:
        return sorted(os.sched_getaffinity(0))
    except AttributeError:
        return list(range(os.cpu_count() or 1))


def _mhz(cores):
    """Current clock of the given cores in MHz: cpufreq where the kernel exposes it, else /proc/cpuinfo."""
    out = []
    for c in cores:
        try:
            with open(f"/sys/devices/system/cpu/cpu{c}/cpufreq/scaling_cur_freq") as f:
                out.append(int(f.read()) / 1000)
        except OSError:
            out = None
            break
    if out:
        return out
    by_cpu, cur = {}, None
    try:
        with open("/proc/cpuinfo") as f:
            for line in f:
                if line.startswith("processor"):
                    cur = int(line.split(":")[1])
                elif line.startswith("cpu MHz") and cur is not None:
                    by_cpu[cur] = float(line.split(":")[1])
    except OSError:
        return []
    return [by_cpu[c] for c in cores if c in by_cpu]


def _max_mhz(core):
    try:
        with open(f"/sys/devices/system/cpu/cpu{core}/cpufreq/cpuinfo_max_freq") as f:
            return int(f.read()) / 1000
    except OSError:
        return None


def _gpu():
    """SM clock (MHz), max SM clock, utilisation (%) and power (W) of this job's GPU, or None."""
    # Where the job's cgroup hides the other GPUs, nvidia-smi sees one card, numbered 0, and
    # SLURM_JOB_GPUS's physical index does not exist for it (the GCNN rerun of 2026-09-24 lost its
    # GPU record that way). Only where it lists several is the physical index needed.
    q = ["--query-gpu=clocks.sm,clocks.max.sm,utilization.gpu,power.draw", "--format=csv,noheader,nounits"]
    try:
        visible = subprocess.run(["nvidia-smi", "-L"], capture_output=True, text=True, timeout=10).stdout.strip().splitlines()
    except Exception:
        return None
    if len(visible) == 1:
        dev = "0"
    else:
        dev = (os.environ.get("SLURM_JOB_GPUS") or os.environ.get("SLURM_STEP_GPUS") or os.environ.get("CUDA_VISIBLE_DEVICES") or "").split(",")[0]
    if not dev:
        return None
    try:
        line = subprocess.run(["nvidia-smi", "-i", dev] + q, capture_output=True, text=True, timeout=10).stdout.strip()
        sm, sm_max, util, power = (float(x) for x in line.split(","))
        return dict(sm=sm, sm_max=sm_max, util=util, power=power)
    except Exception:
        return None


def _stats(xs):
    xs = [x for x in xs if x is not None]
    return dict(mean=round(sum(xs) / len(xs), 1), min=round(min(xs), 1), max=round(max(xs), 1)) if xs else None


class Monitor:
    def __init__(self, period=PERIOD):
        self.t0 = time.perf_counter()
        self.period = period
        self.cores = _cores()
        self.samples = []
        self._stop = threading.Event()
        self._gpu = _gpu() is not None
        threading.Thread(target=self._run, args=(period,), daemon=True).start()

    def _run(self, period):
        while not self._stop.wait(period if self.samples else 1.0):
            mhz = _mhz(self.cores)
            try:
                load = os.getloadavg()[0]
            except OSError:
                load = None
            self.samples.append(dict(t=time.perf_counter() - self.t0, mhz=sum(mhz) / len(mhz) if mhz else None, load=load,
                                     gpu=_gpu() if self._gpu else None))

    def cpu_seconds(self):
        r = resource.getrusage(resource.RUSAGE_SELF)
        return r.ru_utime + r.ru_stime

    def summary(self):
        wall = time.perf_counter() - self.t0
        cpu = self.cpu_seconds()
        s = list(self.samples)
        out = dict(
            sample_period_seconds=self.period, samples=len(s),
            process_cpu_seconds=round(cpu, 1),
            cpu_utilisation=round(cpu / (wall * len(self.cores)), 3) if wall > 0 else None,
            cores=len(self.cores), core_ids=self.cores,
            core_mhz=_stats([x["mhz"] for x in s]), core_max_mhz=_max_mhz(self.cores[0]) if self.cores else None,
            node_cpus=os.cpu_count(), node_load=_stats([x["load"] for x in s]),
        )
        if self._gpu:
            g = [x["gpu"] for x in s if x["gpu"]]
            out["gpu"] = dict(sm_mhz=_stats([x["sm"] for x in g]), sm_max_mhz=g[0]["sm_max"] if g else None,
                              utilisation_percent=_stats([x["util"] for x in g]), power_watts=_stats([x["power"] for x in g]))
        return out
