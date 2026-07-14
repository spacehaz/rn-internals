func slowWork(id: Int) async throws -> String {
    print("Task \(id) starting")
    // Task.sleep is cancellation-aware: it throws CancellationError almost
    // immediately once the task is cancelled, instead of sleeping the full duration.
    try await Task.sleep(for: .seconds(5))
    print("Task \(id) finished sleeping normally") // should NOT print if cancelled early
    return "Result \(id)"
}

@main
struct App {
    static func main() async throws {
        let parent = Task {
            async let a = slowWork(id: 1)
            async let b = slowWork(id: 2)
            do {
                let results = try await (a, b)
                print("Got results: \(results)")
            } catch {
                print("Child work threw: \(error)")
            }
        }

        // Let both children get started, then cancel the parent early —
        // well before their 5-second sleeps would naturally finish.
        try await Task.sleep(for: .milliseconds(300))
        print("--- Cancelling parent now ---")
        parent.cancel()

        // Wait for the parent (and therefore its children) to actually wind down.
        _ = await parent.result
        print("--- Parent fully done ---")
    }
}
