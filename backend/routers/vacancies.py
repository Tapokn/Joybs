from fastapi import APIRouter, Query, HTTPException
from backend.database import get_db
from backend.categories import get_profession_group
import aiosqlite

router = APIRouter()

@router.get("/vacancies")
async def get_vacancies(
    city: str = Query(None),
    skills: str = Query(None),
    experience: str = Query(None),
    salary_from: float = Query(None),
    salary_to: float = Query(None),
    has_salary: bool = Query(None),
    company: str = Query(None),
    offset: int = Query(0),
    limit: int = Query(20)
):
    conn = await get_db()
    query = "SELECT * FROM vacancies WHERE 1=1"
    params = []
    if city:
        query += " AND city = ?"
        params.append(city)
    if experience:
        query += " AND experience = ?"
        params.append(experience)
    if salary_from is not None:
        query += " AND (salary_from >= ? OR salary_to >= ?)"
        params.extend([salary_from, salary_from])
    if salary_to is not None:
        query += " AND (salary_from <= ? OR salary_to <= ?)"
        params.extend([salary_to, salary_to])
    if has_salary is not None:
        query += " AND has_salary = ?"
        params.append(1 if has_salary else 0)
    if company:
        query += " AND company LIKE ?"
        params.append(f"%{company}%")
    if skills:
        query += " AND key_skills LIKE ?"
        params.append(f"%{skills}%")
    
    count_query = f"SELECT COUNT(*) FROM ({query})"
    cursor = await conn.execute(count_query, params)
    total = (await cursor.fetchone())[0]
    
    query += " LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    cursor = await conn.execute(query, params)
    rows = await cursor.fetchall()
    await conn.close()
    items = [dict(row) for row in rows]
    return {"total": total, "items": items}

@router.get("/vacancies/professions")
async def get_professions():
    conn = await get_db()
    cursor = await conn.execute("SELECT DISTINCT profession FROM vacancies ORDER BY profession")
    rows = await cursor.fetchall()
    await conn.close()
    return [row[0] for row in rows]

# ===== НОВЫЙ ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ ПРОФЕССИЙ ПО ГРУППЕ =====
@router.get("/vacancies/professions/by-group")
async def get_professions_by_group(group: str = Query(...)):
    """Возвращает список профессий, принадлежащих указанной группе."""
    conn = await get_db()
    cursor = await conn.execute("SELECT DISTINCT profession FROM vacancies")
    rows = await cursor.fetchall()
    await conn.close()
    professions = [row[0] for row in rows]
    filtered = [p for p in professions if get_profession_group(p) == group]
    return filtered

@router.get("/vacancies/{hh_id}")
async def get_vacancy(hh_id: str):
    conn = await get_db()
    cursor = await conn.execute("SELECT * FROM vacancies WHERE hh_id = ?", (hh_id,))
    row = await cursor.fetchone()
    await conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    return dict(row)