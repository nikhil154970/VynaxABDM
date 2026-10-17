from assistant import query_engine
print('Calling run_query DAILY_REVENUE')
res = query_engine.run_query('DAILY_REVENUE', {})
print('Result:', res)
