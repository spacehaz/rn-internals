@main
struct App {
    static func main() async throws {
        var counter = 0

        await withTaskGroup(of: Void.self) { group in
            for _ in 1...100 {
                group.addTask {
                    // READ, then artificially widen the window before WRITE,
                    // so another task is very likely to read the same stale
                    // value of `counter` before this one writes back.
                    let current = counter
                    try? await Task.sleep(nanoseconds: 1_000_000) // 1ms
                    counter = current + 1
                }
            }
        }

        print("Counter (unsafe, expected 100): \(counter)")
    }
}
