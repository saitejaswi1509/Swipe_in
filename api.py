from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional, List
import os
import hashlib
from sqlalchemy import Date, cast, desc
import uvicorn
import jwt
from typing import Literal
from fastapi import FastAPI, HTTPException, Depends, Query, status, Security
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
from jwt import PyJWTError, decode
from sqlalchemy.orm import Session
from database import engine, SessionLocal
from models import (
    Dining_Categories,
    Dining_Categories_Main,
    User,
    Base,
    Menu,
    Transactions,
    Dining_Menu,
    Swipes,
    Meals,
    Categories
)
from pydantic import BaseModel, EmailStr


SECRET_KEY = os.environ.get("SECRET_KEY", "default_secret_key")
ALGORITHM = "HS256"


app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------- Pydantic Models --------------------
class UserBase(BaseModel):
    username: str
    first_name: str
    last_name: str
    email: str
    password: str
    role: str

class UserResponseModel(BaseModel):
    username: str
    first_name: str
    last_name: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class TransactionModel(BaseModel):
    username: str
    transaction_date: datetime
    transaction_mode: str
    transaction_id: str
    is_successful: bool
    Location: str
    Total_Amount: float
    MNumber: str
    first_name: str

class MealsResponseModel(BaseModel):
    username: str
    first_name: str
    last_name: str
    email: str
    meal_plan: str
    meal_swipes: int
    flex_dollars: float

class PlanUpgradeRequest(BaseModel):
    meal_plan: Literal["Platinum", "Gold", "Silver", "Bronze"]


class StudentRegistration(BaseModel):
    username: str
    first_name: str
    last_name: str
    email: str
    meal_plan: str

class TransactionSummary(BaseModel):
    transaction_date: datetime
    transaction_mode: str
    transaction_id: str
    Total_Amount: float
    Location: str


class StTransactionSummary(BaseModel):
    transaction_date: datetime
    transaction_mode: str
    transaction_id: str
    Total_Amount: float
    Location: str

class StudentWithTxnSummary(BaseModel):
    username: str
    first_name: str
    last_name: str
    email: EmailStr
    meal_plan: str
    meal_swipes: int
    flex_dollars: float
    transactions: List[TransactionSummary] = []



class StudentUpdate(BaseModel):
    first_name:         Optional[str]   = None
    last_name:          Optional[str]   = None
    email:              Optional[EmailStr] = None
    meal_plan:          Optional[str]   = None   
    meal_swipes:        Optional[int]   = None
    meal_swipes_left:   Optional[int]   = None
    flex_dollars:       Optional[float] = None
    flex_dollars_left:  Optional[float] = None  


class SwipesModel(BaseModel):
    username: str
    meal_swipes: int
    meal_swipes_left: int
    flex_dollars: float
    flex_dollars_left: float

class PaymentRequest(BaseModel):
    mnumber: str
    method: str
    total: Optional[float] = None



# ── CFA ───────────────────────

class MenuCreate(BaseModel):
    item_title:       str
    item_description: str
    calories:         int
    price:            float
    category_id:      int

class MenuUpdate(MenuCreate):
    pass

class CategoryCreate(BaseModel):
    category_name: str
    location:      str

class CategoryUpdate(CategoryCreate):
    pass

class CategoryOut(BaseModel):
    category_id:   int
    category_name: str
    location:      str


# ── DINING ─────────────────────────────

class MenuItemIn(BaseModel):
    item_title: str
    item_detail: str
    portion: str
    diet: str
    date: str  # e.g., "2025-03-29"
    calories: int
    category_id: int

class SubCategoryIn(BaseModel):
    category_name: str
    main_category_id: int

class Config:
    orm_mode = True
    json_encoders = {
        datetime: lambda dt: dt.astimezone(ZoneInfo("America/Chicago")).isoformat()
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)

@app.post("/register/", response_model=UserResponseModel, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserBase, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.username == user.username).first()
    existing_email = db.query(User).filter(User.email == user.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = hashlib.sha256(user.password.encode('utf-8')).hexdigest()
    new_user = User(
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        email=user.email,
        password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user



@app.post("/student/register/", response_model=UserResponseModel, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserBase, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.username == user.username).first()
    existing_email = db.query(User).filter(User.email == user.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = hashlib.sha256(user.password.encode('utf-8')).hexdigest()
    new_user = User(
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        email=user.email,
        password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


@app.post("/login/")
async def login(user_creds: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == user_creds.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    hashed_input = hashlib.sha256(user_creds.password.encode('utf-8')).hexdigest()
    if hashed_input != user.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    access_token = create_access_token(
        data={"username": user.username, "role": user.role},
        expires_delta=timedelta(minutes=30)
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "firstname": user.first_name,
        "lastname": user.last_name,
        "email": user.email,
        "username": user.username,
        "role": user.role
    }

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(...)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("username")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
    except PyJWTError as e:
        raise credentials_exception from e
    return {"username": username, "role": role}

@app.get("/CFA_Menu/")
def read_menu(db: Session = Depends(get_db)):
    cfa_menu = db.query(Menu).all()
    if not cfa_menu:
        return JSONResponse(
            content={"message": "No items found"}, 
            status_code=404
        )
    else:
        return [
            {
                "menu_id": item.menu_id,
                "item_title": item.item_title,
                "item_description": item.item_description,
                "calories": item.calories,
                "price": item.price,
                "category_id": item.category_id
            }
            for item in cfa_menu
        ]

@app.get("/Dining_Menu/")
def read_menu(db: Session = Depends(get_db)):
    dinig_menu = db.query(Dining_Menu).all()
    if not dinig_menu:
        return JSONResponse(
            content={"message": "No items found"}, 
            status_code=404
        )
    else:
        return [
            {
                "menu_id": items.menu_id,
                "item_title": items.item_title,
                "item_detail": items.item_detail,
                "portion": items.portion,
                "diet": items.diet,
                "date": items.date,
                "calories": items.calories,
                "main_category": (
                    items.dining_category.dining_categories_main.main_category_name
                ),
                "subcategory": items.dining_category.category_name,
            }
            for items in dinig_menu
        ]
    

@app.get("/dining_menu/")
def read_dining_menu_items(db: Session = Depends(get_db)):
    dining_menu_items = db.query(Dining_Menu).all()
    if not dining_menu_items:
        return JSONResponse(
            content={"message": "No items found"}, 
            status_code=404
        )
    else:
        return [
            {
                "menu_id": item.menu_id,
                "item_title": item.item_title,
                "item_detail": item.item_detail,
                "portion": item.portion,
                "diet": item.diet,
                "date": item.date,
                "calories": item.calories,
                "category_id": item.category_id,
            }
            for item in dining_menu_items
        ]

@app.get("/Dining_Categories_Main/")
def read_dining_menu(db: Session = Depends(get_db)):
    dining_menu_main = db.query(Dining_Categories_Main).all()
    return dining_menu_main 

@app.get("/Dining_Categories/")
def read_dining_menu(db: Session = Depends(get_db)):
    dining_menu = db.query(Dining_Categories).all()
    return dining_menu 



@app.post("/Dining_Menu/")
def create_menu(item: MenuItemIn, db: Session = Depends(get_db)):
    # Check if category exists
    category = db.query(Dining_Categories).filter_by(category_id=item.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    new_item = Dining_Menu(**item.dict())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return {
        "menu_id": new_item.menu_id,
        "item_title": new_item.item_title,
        "item_detail": new_item.item_detail,
        "portion": new_item.portion,
        "diet": new_item.diet,
        "date": new_item.date,
        "calories": new_item.calories,
        "category_id": new_item.category_id,
    }

@app.put("/Dining_Menu/{menu_id}")
def update_menu(menu_id: int, item: MenuItemIn, db: Session = Depends(get_db)):
    menu = db.query(Dining_Menu).filter_by(menu_id=menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu item not found")

    category = db.query(Dining_Categories).filter_by(category_id=item.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    for key, value in item.dict().items():
        setattr(menu, key, value)

    db.commit()
    db.refresh(menu)

    return {
        "menu_id": menu.menu_id,
        "item_title": menu.item_title,
        "item_detail": menu.item_detail,
        "portion": menu.portion,
        "diet": menu.diet,
        "date": menu.date,
        "calories": menu.calories,
        "category_id": menu.category_id,
    }

@app.delete("/Dining_Menu/{menu_id}")
def delete_menu(menu_id: int, db: Session = Depends(get_db)):
    menu = db.query(Dining_Menu).filter_by(menu_id=menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu item not found")

    db.delete(menu)
    db.commit()
    return {"message": f"Menu item {menu_id} deleted successfully"}


@app.post(
    "/Dining_Categories/",
    response_model=dict,
    summary="Create a new sub‑category",
)
def create_subcategory(
    cat: SubCategoryIn,
    db: Session = Depends(get_db),
):
    # verify the main_category exists
    main = (
        db.query(Dining_Categories_Main)
        .filter_by(main_category_id=cat.main_category_id)
        .first()
    )
    if not main:
        raise HTTPException(status_code=404, detail="Main category not found")

    new_cat = Dining_Categories(**cat.dict())
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)

    return {
        "category_id": new_cat.category_id,
        "category_name": new_cat.category_name,
        "main_category_id": new_cat.main_category_id,
    }


@app.put(
    "/Dining_Categories/{category_id}",
    response_model=dict,
    summary="Update an existing sub‑category",
)
def update_subcategory(
    category_id: int,
    cat: SubCategoryIn,
    db: Session = Depends(get_db),
):
    existing = (
        db.query(Dining_Categories)
        .filter_by(category_id=category_id)
        .first()
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Sub‑category not found")

    # verify the new main_category_id exists
    main = (
        db.query(Dining_Categories_Main)
        .filter_by(main_category_id=cat.main_category_id)
        .first()
    )
    if not main:
        raise HTTPException(status_code=404, detail="Main category not found")

    # apply updates
    existing.category_name = cat.category_name
    existing.main_category_id = cat.main_category_id

    db.commit()
    db.refresh(existing)

    return {
        "category_id": existing.category_id,
        "category_name": existing.category_name,
        "main_category_id": existing.main_category_id,
    }


@app.delete(
    "/Dining_Categories/{category_id}",
    summary="Delete a sub‑category",
    response_class=JSONResponse,
)
def delete_subcategory(
    category_id: int,
    db: Session = Depends(get_db),
):
    sub = (
        db.query(Dining_Categories)
        .filter_by(category_id=category_id)
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Sub‑category not found")

    db.delete(sub)
    db.commit()

    return JSONResponse(
        content={"message": f"Sub‑category {category_id} deleted"},
        status_code=200,
    )

@app.post("/payments/")
async def process_payment(payment: PaymentRequest, db: Session = Depends(get_db)):
    swipe = db.query(Swipes).filter(Swipes.username == payment.mnumber).first()
    
    if not swipe:
        raise HTTPException(status_code=404, detail="Swipes record not found for this MNumber.")

    # Process payment based on method
    if payment.method == "Meal Swipes":
        if swipe.meal_swipes_left < 1:
            raise HTTPException(status_code=400, detail="No meal swipes left.")
        swipe.meal_swipes_left -= 1

    elif payment.method == "Flex Dollars":
        if payment.total is None:
            raise HTTPException(status_code=400, detail="No total amount specified.")
        if swipe.flex_dollars_left < payment.total:
            raise HTTPException(status_code=400, detail="Insufficient flex dollars.")
        swipe.flex_dollars_left -= payment.total

    else:
        raise HTTPException(

            status_code=400, 
            detail="Unsupported payment method for this endpoint."
        )

    db.commit()
    db.refresh(swipe)
    return {
        "method": payment.method,
        "meal_swipes_left": swipe.meal_swipes_left,
        "flex_dollars_left": swipe.flex_dollars_left,
    }

@app.get("/swipe/{username}")
async def get_swipe(username: str, db: Session = Depends(get_db)):
    swipe = db.query(Swipes).filter(Swipes.username == username).first()
    if not swipe:
        raise HTTPException(status_code=404, detail="Swipe record not found.")
    return {
        "username": swipe.username,
        "meal_swipes_left": swipe.meal_swipes_left,
        "flex_dollars_left": swipe.flex_dollars_left,
    }


@app.post("/transaction/", response_model=TransactionModel)
async def create_transaction(transaction: TransactionModel, db: Session = Depends(get_db)):
    transaction_datetime = transaction.transaction_date

    if transaction_datetime.hour == 0 and transaction_datetime.minute == 0:
        now = datetime.now()
        transaction_datetime = transaction_datetime.replace(
            hour=now.hour, minute=now.minute, second=now.second
        )

    new_transaction = Transactions(
        username=transaction.username,
        transaction_date=transaction_datetime,
        transaction_mode=transaction.transaction_mode,
        transaction_id=transaction.transaction_id,
        is_successful=transaction.is_successful,
        Location=transaction.Location,
        Total_Amount=transaction.Total_Amount,
        MNumber=transaction.MNumber,
        first_name=transaction.first_name
    )
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    return new_transaction

@app.get("/Transactions/")
async def get_transactions(db: Session = Depends(get_db)):
    transactions = db.query(Transactions).all()
    if not transactions:
        raise HTTPException(status_code=404, detail="No transactions found.")
    return [
        {
            "transaction_id": transaction.transaction_id,
            "username": transaction.username,
            "transaction_date": transaction.transaction_date.isoformat(),
            "transaction_mode": transaction.transaction_mode,
            "is_successful": transaction.is_successful,
            "Location": transaction.Location,
            "Total_Amount": transaction.Total_Amount,
            "MNumber": transaction.MNumber,
            "first_name": transaction.first_name
        }
        for transaction in transactions
    ]

@app.post("/student/registration/")
async def register_student(student: StudentRegistration, db: Session = Depends(get_db)):
    # -------- duplicates --------
    if db.query(Meals).filter_by(username = student.username).first():
        raise HTTPException(400, "Username already registered")
    if db.query(Meals).filter_by(email = student.email).first():
        raise HTTPException(400, "Email already registered")


    PLAN_SWIPES = {"Platinum": 600, "Gold": 200, "Silver": 150, "Bronze": 75}
    plan = student.meal_plan   
    if plan not in PLAN_SWIPES:
        raise HTTPException(400, "Invalid meal plan")
    meal_swipes  = PLAN_SWIPES[plan]
    flex_dollars = 100

    new_meal = Meals(
        username     = student.username,
        first_name   = student.first_name,
        last_name    = student.last_name,
        email        = student.email,
        meal_plan    = plan,
        meal_swipes  = meal_swipes,
        flex_dollars = flex_dollars,
    )
    new_swipe = Swipes(
        username           = student.username,
        meal_swipes        = meal_swipes,
        meal_swipes_left   = meal_swipes,
        flex_dollars       = flex_dollars,
        flex_dollars_left  = flex_dollars,
    )

    db.add_all([new_meal, new_swipe])
    db.commit()
    db.refresh(new_meal)
    db.refresh(new_swipe)
 


@app.get("/total_swipes/", response_model=list[dict], summary="Get all swipes on a given date")
def read_swipes(
    date: str = Query(..., description="Date in YYYY-MM-DD (America/Chicago)"),
    db: Session = Depends(get_db),
):
    try:
        target_day = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    swipes = (
        db.query(Transactions)  # or whatever your model is called
          .filter(cast(Transactions.transaction_date, Date) == target_day)
          .all()
    )

    return [
        {
            "id": swipe.transaction_id,
            "mode": swipe.transaction_mode,
            "amount": swipe.Total_Amount,
            "timestamp": swipe.transaction_date.isoformat()
        }
        for swipe in swipes
    ]




@app.get("/users/")
def read_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role == "EMPLOYEE").all()
    return users    
    


@app.get("/student_users/")
def read_users(db: Session = Depends(get_db)):
    users = db.query(Meals).all()
    return users    
    
@app.get("/users/{username}")
def read_user(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.put("/users/{username}")
def update_user(
    username: str,
    user: UserBase,
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(User.username == username).first()
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for duplicates
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_user.first_name = user.first_name
    existing_user.last_name = user.last_name
    existing_user.email = user.email
    existing_user.password = hashlib.sha256(user.password.encode('utf-8')).hexdigest()

    db.commit()
    db.refresh(existing_user)

    return existing_user


@app.delete("/users/{username}")
def delete_user(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()

    return {"message": f"User {username} and associated swipes record deleted."}




@app.delete("/student_users/{username}")
def delete_user(username: str, db: Session = Depends(get_db)):
    user = db.query(Meals).filter(Meals.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    swipes = db.query(Swipes).filter(Swipes.username == username).first()

    if swipes:
        db.delete(swipes)

    db.delete(user)
    db.commit()

    return {"message": f"User {username} and associated swipes record deleted."}


@app.put("/student_users/{username}")
def update_student(
    username: str,
    patch: StudentUpdate,
    db: Session = Depends(get_db),
):
    student = db.query(Meals).filter(Meals.username == username).first()
    if not student:
        raise HTTPException(404, "Student not found")

    swipe = db.query(Swipes).filter(Swipes.username == username).first()

    if patch.email and patch.email != student.email:
        if db.query(Meals).filter(Meals.email == patch.email).first():
            raise HTTPException(400, "Email already in use")
        student.email = patch.email

    if patch.first_name:
        student.first_name = patch.first_name
    if patch.last_name:
        student.last_name = patch.last_name

    if patch.meal_plan:
        PLAN_SWIPES = {"Platinum":600,"Gold":200,"Silver":150,"Bronze":75}
        plan = patch.meal_plan
        if plan not in PLAN_SWIPES:
            raise HTTPException(400, "Invalid meal plan")
        new_swipes = PLAN_SWIPES[plan]
        student.meal_plan   = plan
        student.meal_swipes = new_swipes
        student.flex_dollars = 100.0

        if swipe:
            swipe.meal_swipes       = new_swipes
            swipe.meal_swipes_left  = new_swipes
            swipe.flex_dollars      = 100.0
            swipe.flex_dollars_left = 100.0
        else:
            db.add(
                Swipes(
                    username           = username,
                    meal_swipes        = new_swipes,
                    meal_swipes_left   = new_swipes,
                    flex_dollars       = 100.0,
                    flex_dollars_left  = 100.0,
                )
            )

    if patch.meal_swipes is not None:
        if patch.meal_swipes < 0:
            raise HTTPException(400, "meal_swipes cannot be negative")
        student.meal_swipes = patch.meal_swipes
        if swipe:
            swipe.meal_swipes = patch.meal_swipes

    if patch.meal_swipes_left is not None:
        if patch.meal_swipes_left < 0:
            raise HTTPException(400, "meal_swipes_left cannot be negative")
        total_sw = patch.meal_swipes or student.meal_swipes
        if patch.meal_swipes_left > total_sw:
            raise HTTPException(400, "Remaining swipes cannot exceed total")
        if swipe:
            swipe.meal_swipes_left = patch.meal_swipes_left

    if swipe and swipe.meal_swipes_left > swipe.meal_swipes:
        swipe.meal_swipes_left = swipe.meal_swipes

    if patch.flex_dollars is not None:
        if patch.flex_dollars < 0:
            raise HTTPException(400, "flex_dollars cannot be negative")
        student.flex_dollars = patch.flex_dollars
        if swipe:
            swipe.flex_dollars = patch.flex_dollars

    if patch.flex_dollars_left is not None:
        if patch.flex_dollars_left < 0:
            raise HTTPException(400, "flex_dollars_left cannot be negative")
        total_fx = patch.flex_dollars or student.flex_dollars
        if patch.flex_dollars_left > total_fx:
            raise HTTPException(400, "Remaining flex dollars cannot exceed total")
        if swipe:
            swipe.flex_dollars_left = patch.flex_dollars_left

    if swipe and swipe.flex_dollars_left > swipe.flex_dollars:
        swipe.flex_dollars_left = swipe.flex_dollars

    db.commit()
    db.refresh(student)
    return student


@app.put(
    "/student_users_upgrade/{username}",
    response_model=MealsResponseModel,
    summary="Upgrade a student’s meal plan (carry over used swipes, add $100 flex)"
)
def upgrade_meal_plan(
    username: str,
    req: PlanUpgradeRequest,
    db: Session = Depends(get_db),
):
    # 1) Load student + swipes row
    student = db.query(Meals).filter(Meals.username == username).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    swipe = db.query(Swipes).filter(Swipes.username == username).first()

    # 2) Compute used swipes & remaining flex
    old_total_swipes = student.meal_swipes or 0
    used_swipes      = 0
    old_left_flex    = student.flex_dollars or 0.0
    if swipe:
        used_swipes   = old_total_swipes - (swipe.meal_swipes_left or 0)
        old_left_flex = swipe.flex_dollars_left or 0.0

    # 3) New plan defaults
    PLAN_SWIPES    = {"Platinum": 600, "Gold": 200, "Silver": 150, "Bronze": 75}
    new_total_swipes = PLAN_SWIPES.get(req.meal_plan)
    FLEX_TOP_UP      = 100.0

    # 4) Compute new “left” values
    new_left_swipes = max(new_total_swipes - used_swipes, 0)
    new_total_flex  = old_left_flex + FLEX_TOP_UP
    new_left_flex   = new_total_flex

    # 5) Apply to Meals record
    student.meal_plan   = req.meal_plan
    student.meal_swipes = new_total_swipes
    student.flex_dollars= new_total_flex

    # 6) Apply to or create Swipes record
    if swipe:
        swipe.meal_swipes       = new_total_swipes
        swipe.meal_swipes_left  = new_left_swipes
        swipe.flex_dollars      = new_total_flex
        swipe.flex_dollars_left = new_left_flex
    else:
        new_swipe = Swipes(
            username           = username,
            meal_swipes        = new_total_swipes,
            meal_swipes_left   = new_left_swipes,
            flex_dollars       = new_total_flex,
            flex_dollars_left  = new_left_flex,
        )
        db.add(new_swipe)

    db.commit()
    db.refresh(student)
    return student

@app.get(
    "/transactions/{username}",
    response_model=List[StTransactionSummary],
    summary="Get all transactions for one student",
)
def read_transactions_for_user(
    username: str,
    db: Session = Depends(get_db)
):

    txs = (
        db.query(Transactions)
          .filter(Transactions.MNumber == username)
          .order_by(desc(Transactions.transaction_date))
          .all()
    )
    if not txs:
        raise HTTPException(
            status_code=404,
            detail=f"No transactions found for user {username}"
        )

    return [
        TransactionSummary(
            transaction_date=t.transaction_date,
            transaction_mode=t.transaction_mode,
            transaction_id=t.transaction_id,
            Total_Amount=t.Total_Amount,
            Location=t.Location
        )
        for t in txs
    ]

@app.get( "/student_users_swipes/", response_model=List[StudentWithTxnSummary])
def read_student_users_swipes(db: Session = Depends(get_db)):
    
    meals = db.query(Meals).all()
    if not meals:
        raise HTTPException(status_code=404, detail="No students found")

    transactions = db.query(Transactions).order_by(desc(Transactions.transaction_date)).all()
    swipes = db.query(Swipes).all()

    transactions_map: dict[str, list[Transactions]] = defaultdict(list)
    for transaction in transactions:
        transactions_map[transaction.MNumber].append(transaction)

    swipes_map = { s.username: s for s in swipes }

    transactions_by_user = []
    for m in meals:
        left = swipes_map.get(m.username)
        transactions_by_user.append({
            "username":     m.username,
            "first_name":   m.first_name,
            "last_name":    m.last_name,
            "email":        m.email,
            "meal_plan":    m.meal_plan,
            "meal_swipes":  left.meal_swipes_left   if left else 0,
            "flex_dollars": left.flex_dollars_left  if left else 0,
            "transactions": transactions_map.get(m.username, [])
        })

    return transactions_by_user


@app.get("/swipe_balance/{username}")
def get_swipe_balance(username: str, db: Session = Depends(get_db)):
    swipe = db.query(Swipes).filter(Swipes.username == username).first()
    if not swipe:
        raise HTTPException(status_code=404, detail="Swipe record not found.")
    return {
        "username": swipe.username,
        "meal_swipes_left": swipe.meal_swipes_left,
        "flex_dollars_left": swipe.flex_dollars_left,
    }

@app.get("/meal_plan/{username}")
def get_meal_plan(username: str, db: Session = Depends(get_db)):
    meal_plan = db.query(Meals).filter(Meals.username == username).first()
    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan not found.")
    return {
        "username": meal_plan.username,
        "meal_plan": meal_plan.meal_plan,
       
    }


@app.post("/CFA_Menu/", status_code=status.HTTP_201_CREATED)
def create_menu_item(
    menu_in: MenuCreate,
    db:      Session = Depends(get_db)
):
    m = Menu(**menu_in.dict())
    db.add(m)
    db.commit()
    db.refresh(m)
    return {
        "menu_id": m.menu_id,
        "item_title": m.item_title,
        "item_description": m.item_description,
        "calories": m.calories,
        "price": m.price,
        "category_id": m.category_id
    }

@app.put("/CFA_Menu/{menu_id}")
def update_menu_item(
    menu_id: int,
    menu_in: MenuUpdate,
    db:      Session = Depends(get_db)
):
    m = db.query(Menu).filter(Menu.menu_id == menu_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Menu item not found")
    for field, val in menu_in.dict().items():
        setattr(m, field, val)
    db.commit()
    db.refresh(m)
    return {
        "menu_id": m.menu_id,
        "item_title": m.item_title,
        "item_description": m.item_description,
        "calories": m.calories,
        "price": m.price,
        "category_id": m.category_id
    }

@app.delete("/CFA_Menu/{menu_id}")
def delete_menu_item(
    menu_id: int,
    db:      Session = Depends(get_db)
):
    m = db.query(Menu).filter(Menu.menu_id == menu_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Menu item not found")
    db.delete(m)
    db.commit()
    return JSONResponse(
        content={"message": f"Menu item {menu_id} deleted."},
        status_code=status.HTTP_204_NO_CONTENT
    )


# ── CATEGORIES ──────────────────────────────────────────────────────────


@app.get(
    "/CFA_Categories/",
    response_model=List[CategoryOut]
)
def read_categories(db: Session = Depends(get_db)):
    cats = db.query(Categories).all()
    if not cats:
        # optional: return empty list instead of 404
        return JSONResponse({"message": "No categories found"}, status_code=404)
    return cats

@app.post("/CFA_Categories/", status_code=status.HTTP_201_CREATED)
def create_category(
    cat_in: CategoryCreate,
    db:     Session = Depends(get_db)
):
    c = Categories(**cat_in.dict())
    db.add(c)
    db.commit()
    db.refresh(c)
    return {
        "category_id": c.category_id,
        "category_name": c.category_name,
        "location": c.location,
    }

@app.put("/CFA_Categories/{category_id}")
def update_category(
    category_id: int,
    cat_in:      CategoryUpdate,
    db:          Session = Depends(get_db)
):
    c = db.query(Categories).filter(Categories.category_id == category_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, val in cat_in.dict().items():
        setattr(c, field, val)
    db.commit()
    db.refresh(c)
    return {
        "category_id": c.category_id,
        "category_name": c.category_name,
        "location": c.location,
    }

@app.delete("/CFA_Categories/{category_id}")
def delete_category(
    category_id: int,
    db:          Session = Depends(get_db)
):
    c = db.query(Categories).filter(Categories.category_id == category_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    # optionally: delete all Menu items in this category first
    db.delete(c)
    db.commit()
    return JSONResponse(
        content={"message": f"Category {category_id} deleted."},
        status_code=status.HTTP_204_NO_CONTENT
    )



if __name__ == "__main__":
    uvicorn.run(
        "api:app",
        host="127.0.0.1",
        port=8081,
        reload=True
    )
