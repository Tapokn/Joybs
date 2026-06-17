from fastapi import APIRouter, Query, HTTPException
from backend.database import get_db
from backend.categories import get_profession_group
from backend.routers.analytics import parse_skills
import aiosqlite
import math
from collections import Counter, defaultdict
from itertools import combinations
from typing import Optional

router = APIRouter()

def jaccard(set1, set2):
    if not set1 or not set2:
        return 0
    inter = len(set1 & set2)
    union = len(set1 | set2)
    return inter / union if union else 0

@router.get("/graph/professions")
async def get_professions_graph(
    threshold: float = Query(0.1, ge=0, le=1),
    min_vacancies: int = Query(5),
    group: Optional[str] = Query(None)
):
    conn = await get_db()
    cursor = await conn.execute("SELECT profession, key_skills FROM vacancies")
    rows = await cursor.fetchall()
    await conn.close()
    rows = [dict(r) for r in rows]
    
    # Фильтруем по группе, если указана
    if group:
        rows = [r for r in rows if r.get('profession') and get_profession_group(r['profession']) == group]
    
    # Считаем количество вакансий по профессиям
    prof_count = Counter()
    for r in rows:
        prof = r.get('profession')
        if prof:
            prof_count[prof] += 1
    
    # Оставляем профессии с >= min_vacancies
    popular_profs = [p for p, cnt in prof_count.items() if cnt >= min_vacancies]
    if not popular_profs:
        return {"nodes": [], "edges": []}
    
    # Собираем навыки для каждой профессии
    prof_skills = {}
    for prof in popular_profs:
        skills_set = set()
        for r in rows:
            if r.get('profession') == prof:
                skills = parse_skills(r.get('key_skills'))
                skills_set.update(skills)
        prof_skills[prof] = skills_set
    
    # Строим узлы
    nodes = []
    for prof in popular_profs:
        group_name = get_profession_group(prof) or "Другое"
        nodes.append({
            "id": f"prof_{prof}",
            "label": prof,
            "group": group_name,
            "vacancy_count": prof_count[prof]
        })
    
    # Строим ребра по Жаккару
    edges = []
    prof_list = list(popular_profs)
    for i in range(len(prof_list)):
        for j in range(i+1, len(prof_list)):
            p1, p2 = prof_list[i], prof_list[j]
            jac = jaccard(prof_skills[p1], prof_skills[p2])
            if jac >= threshold:
                common_skills = list(prof_skills[p1] & prof_skills[p2])
                edges.append({
                    "source": f"prof_{p1}",
                    "target": f"prof_{p2}",
                    "weight": jac,
                    "common_skills": common_skills[:10]
                })
    
    return {"nodes": nodes, "edges": edges}

@router.get("/graph/profession/{profession_name}/skills")
async def get_profession_skills(profession_name: str, limit: int = Query(10)):
    conn = await get_db()
    cursor = await conn.execute("SELECT key_skills FROM vacancies WHERE profession = ?", (profession_name,))
    rows = await cursor.fetchall()
    await conn.close()
    skill_counter = Counter()
    for row in rows:
        skills = parse_skills(row[0])
        skill_counter.update(skills)
    top = skill_counter.most_common(limit)
    return [{"skill": s, "count": c} for s, c in top]

@router.get("/graph/edge/skills")
async def get_edge_skills(prof_a: str, prof_b: str):
    conn = await get_db()
    cursor = await conn.execute("SELECT profession, key_skills FROM vacancies WHERE profession IN (?, ?)", (prof_a, prof_b))
    rows = await cursor.fetchall()
    await conn.close()
    skills_a = set()
    skills_b = set()
    for row in rows:
        prof = row[0]
        skills = parse_skills(row[1])
        if prof == prof_a:
            skills_a.update(skills)
        elif prof == prof_b:
            skills_b.update(skills)
    common = list(skills_a & skills_b)
    return {"common_skills": common}