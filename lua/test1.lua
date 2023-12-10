print("Hello world!")

print("Testing API test1: this should print...")
api:test1()
print("testing API test2.. this should fail?")
api:test2()
print("testing API test3.. this should await?")
api:test3():await()
print("testing API test4.. this should await?")
api:__test4()

print("I woke up.")
return "boo"