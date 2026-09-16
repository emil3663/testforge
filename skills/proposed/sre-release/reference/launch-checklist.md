# Launch coordination checklist

From SRE Book Ch. 27. Walk this for anything with real users. Not every question applies —
answer or explicitly mark N/A. An unanswered question is a risk you have chosen not to look at.

## Architecture and dependencies

- [ ] What is the request flow, end to end — user → frontend → backend?
- [ ] Are there different request types with different latency requirements?
- [ ] Are user-facing requests isolated from non-user-facing traffic?
- [ ] Have traffic-volume assumptions been validated? (A single page view may generate many
      requests — count them, don't estimate them.)

## Integration

- [ ] New DNS names created and propagated?
- [ ] Load balancers configured?
- [ ] Monitoring configured — the four golden signals, symptom-based alerts? (`sre-monitoring`)
- [ ] Is there an SLO, and is it measurable today? (`sre-slo`)

## Capacity planning

- [ ] Is the launch tied to a press release, ad campaign, or promotion?
- [ ] What traffic volume and growth rate are expected — and what is the basis?
- [ ] Have compute/storage resources actually been secured, not just requested?
- [ ] Does the plan survive a spike of **15x** the estimate?
- [ ] Is there a regional/gradual rollout to build confidence before full exposure?

## Failure modes

- [ ] Any single points of failure? Enumerate them.
- [ ] What happens when each dependency is unavailable — slow, erroring, or hanging?
- [ ] Are there **request deadlines**, and do they propagate downstream? (`sre-overload`)
- [ ] Is there **load shedding** to reject early under overload?
- [ ] Has degraded-mode behaviour been defined and exercised?

## Client behaviour

- [ ] Does the client auto-save, auto-complete, poll, or heartbeat?
- [ ] Is there **exponential backoff** on failure?
- [ ] Is there **jitter** on every automatic/scheduled request?
- [ ] Can client behaviour (sync frequency, retry params, feature enablement) be changed
      server-side without shipping a new client?

## Processes and automation

- [ ] Which manual processes are required to operate the service? Are they documented?
- [ ] Is the build and release procedure automated?
- [ ] Is there a documented, tested rollback?
- [ ] Are there playbooks for the expected alerts? (~3x MTTR improvement — `sre-incident`)

## Development process

- [ ] All code **and configuration** in version control?
- [ ] Release branch per release, with cherry-picks rather than merges back?
- [ ] Hermetic, reproducible builds?

## External dependencies

- [ ] What third-party code, data, services, or events does the launch depend on?
- [ ] Do partners depend on this service and need notification?
- [ ] What is the contingency if a third party misses its deadline?
- [ ] Can vendor risk be reduced with a filtering proxy, transcoding, or a cache?

## Rollout planning

- [ ] Is there a written launch plan with an owner per step?
- [ ] Have the risks in individual steps been identified?
- [ ] Are there contingency measures — including backup messaging if a feature isn't ready?
- [ ] Have load tests been run, and is the overload behaviour understood?
- [ ] Is there a named decision-maker for "abort the launch"?
