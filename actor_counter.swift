actor RequestCounter {
    // Only code running "inside" this actor can touch this property directly.
    private var count = 0

    // Callable from outside, but the compiler forces `await` at every call site
    // outside the actor — that `await` is your signal: "this call might queue
    // up behind another one currently running on this actor."
    func increment() {
        count += 1
    }

    func getCount() -> Int {
        count
    }
}

@main
struct App {
    static func main() async throws {
        let counter = RequestCounter()

        await withTaskGroup(of: Void.self) { group in
            for _ in 1...100 {
                group.addTask {
                    // Cross-actor call — must be awaited. The actor's serial
                    // executor lets only ONE of these run its body at a time,
                    // no matter how many child tasks call it concurrently.
                    await counter.increment()
                }
            }
        }

        let final = await counter.getCount()
        print("Counter (actor-protected, expected 100): \(final)")
    }
}
