from fastapi import APIRouter, Depends

from app.deps import get_optional_user_id, get_supabase
from app.schemas import FeedbackIn
from supabase import Client

router = APIRouter()


@router.post("", status_code=201)
def submit_feedback(
    feedback: FeedbackIn,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> dict:
    row = (
        sb.table("feedback")
        .insert(
            {
                "user_id": user_id,
                "agent_run_id": str(feedback.agent_run_id) if feedback.agent_run_id else None,
                "rating": feedback.rating,
                "flag_inaccurate": feedback.flag_inaccurate,
                "comment": feedback.comment,
            }
        )
        .execute()
        .data[0]
    )
    return {"id": row["id"]}
