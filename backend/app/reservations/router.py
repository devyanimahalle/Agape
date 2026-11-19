from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.reservations import geocode, service
from app.reservations.deps import get_db, require_ngo, require_ngo_or_provider, require_verified_ngo
from app.reservations.errors import ApiError
from app.reservations.schemas import (
    BoardListingOut,
    GeocodeOut,
    ListingOut,
    RateProviderIn,
    RateProviderOut,
    ReservationOut,
)

router = APIRouter(tags=["reservations"])


@router.get("/geocode", response_model=list[GeocodeOut])
def geocode_address(q: str = Query(min_length=3, max_length=200), _user=Depends(require_ngo_or_provider)):
    return geocode.search(q)


@router.get("/board", response_model=list[BoardListingOut])
def board(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    user=Depends(require_verified_ngo),
    db: Session = Depends(get_db),
):
    if lat is None or lng is None:  # fall back to the NGO's saved location
        saved = service.ngo_location(db, user.id)
        if saved is None:
            raise ApiError(400, "LOCATION_REQUIRED", "Provide lat and lng or save a location on your profile")
        lat, lng = saved
    return [
        BoardListingOut.model_validate(
            {
                **ListingOut.model_validate(i["listing"]).model_dump(),
                "distance_km": i["distance_km"],
                "org_name": i["org_name"],
                "rating_avg": i["rating_avg"],
                "rating_count": i["rating_count"],
                "provider_category": i["provider_category"],
            }
        )
        for i in service.get_board(db, lat, lng)
    ]


@router.post("/listings/{listing_id}/reserve", response_model=ListingOut)
def reserve(listing_id: int, user=Depends(require_verified_ngo), db: Session = Depends(get_db)):
    return service.reserve_listing(db, user.id, listing_id)


@router.post("/listings/{listing_id}/cancel-reservation", response_model=ListingOut)
def cancel_reservation(listing_id: int, user=Depends(require_ngo), db: Session = Depends(get_db)):
    return service.cancel_reservation(db, user.id, listing_id)


@router.post("/listings/{listing_id}/complete", response_model=ListingOut)
def complete(
    listing_id: int,
    files: list[UploadFile] = File(default=[]),
    note: str | None = Form(default=None, max_length=1000),
    user=Depends(require_ngo),
    db: Session = Depends(get_db),
):
    return service.complete_pickup(db, user.id, listing_id, files, note)


@router.get("/ngo/reservations", response_model=list[ReservationOut])
def my_reservations(
    status: str | None = Query(default=None, pattern="^(listed|reserved|completed|cancelled|expired)$"),
    user=Depends(require_verified_ngo),
    db: Session = Depends(get_db),
):
    return [
        ReservationOut.model_validate(
            {
                **ListingOut.model_validate(i["listing"]).model_dump(),
                "org_name": i["org_name"],
                "provider_category": i["provider_category"],
                "has_rated": i["has_rated"],
            }
        )
        for i in service.my_reservations(db, user.id, status)
    ]


@router.post("/listings/{listing_id}/rate-provider", response_model=RateProviderOut, status_code=201)
def rate_provider(
    listing_id: int, body: RateProviderIn, user=Depends(require_ngo), db: Session = Depends(get_db)
):
    return service.rate_provider(db, user.id, listing_id, body.stars, body.comment)
