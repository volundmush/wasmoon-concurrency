print("Hello world!")

print(api)
print("Testing API test1: this should print...")
api:test1()
print("testing API test3.. this should await?")
api:test3():await()
print("I woke up.")
print("testing API test4.. this should print...")
api:test4("huzzah", 1, 5, nil)

return "boo"