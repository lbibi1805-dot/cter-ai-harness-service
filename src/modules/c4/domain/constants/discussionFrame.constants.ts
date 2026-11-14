/** One topic of the design discussion's fixed frame (12/11 plan 04 §5.3, T1–T7), in output order. */
export interface DiscussionSection {
  heading: string;
  /** Lower-case words that identify the topic in a model-written heading. */
  keys: readonly string[];
}

/** Body of a topic the model left out: kept visible so the gap is seen, without another model call. */
export const DISCUSSION_PLACEHOLDER = '_Chưa phân tích._';

/** T1 cloud → T2 deployment → T3 resilience → T4 observability → T5 multi-tenancy → T6 security → T7 instances. */
export const DISCUSSION_SECTIONS: readonly DiscussionSection[] = [
  { heading: '## 1. Chuyển dữ liệu lên cloud', keys: ['cloud', 'đám mây', 'on-prem', 'migration', 'di chuyển dữ liệu'] },
  { heading: '## 2. Chiến lược triển khai', keys: ['triển khai', 'deployment', 'deploy', 'ci/cd'] },
  { heading: '## 3. Khả năng chịu lỗi (Kafka, circuit breaker, rate limiting, replication)', keys: ['chịu lỗi', 'resilience', 'kafka', 'circuit', 'rate limit', 'replica'] },
  { heading: '## 4. Giám sát (observability: Grafana, Datadog)', keys: ['observability', 'giám sát', 'quan sát', 'monitoring', 'grafana', 'datadog'] },
  { heading: '## 5. Multi-tenancy', keys: ['tenan', 'đa người thuê'] },
  { heading: '## 6. Bảo mật (security service)', keys: ['bảo mật', 'security', 'xác thực', 'identity'] },
  { heading: '## 7. Số instance và auto-scaling', keys: ['instance', 'scaling', 'scale', 'mở rộng', 'co giãn'] },
];

/**
 * Heading matching order when a heading has no topic number: specific topics first (a resilience heading
 * often says "replication / deployment", an instances heading "scaling the deployment").
 */
export const DISCUSSION_MATCH_ORDER: readonly number[] = [4, 6, 2, 3, 5, 0, 1];

/** "1.", "2)", "T3", "3 -" at the start of a heading: the topic number the frame asked for. */
export const DISCUSSION_NUMBER = /^\s*(?:t)?([1-7])\s*[.):\-–]?\s/i;
