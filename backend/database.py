import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'hh_parser.db')

async def get_db():
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row
    # Создаем индексы для ускорения
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_profession ON vacancies(profession);")
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_search_query ON vacancies(search_query);")
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_salary_currency ON vacancies(salary_currency);")
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_experience ON vacancies(experience);")
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_city ON vacancies(city);")
    await conn.commit()
    return conn
