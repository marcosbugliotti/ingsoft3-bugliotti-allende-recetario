from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class IngredientCreate(BaseModel):
    name: str = Field(min_length=1)
    unit: str = Field(min_length=1)


class IngredientOut(BaseModel):
    id: int
    name: str
    unit: str

    model_config = {"from_attributes": True}


class RecipeIngredientIn(BaseModel):
    ingredient_id: int
    quantity_base: float = Field(gt=0)


class RecipeIngredientOut(BaseModel):
    ingredient: IngredientOut
    quantity_base: float
    quantity_scaled: float

    model_config = {"from_attributes": True}


class RecipeCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    servings_base: int = Field(gt=0)
    prep_time_minutes: int = Field(ge=0)
    ingredients: list[RecipeIngredientIn] = Field(default_factory=list)


class RecipeUpdate(RecipeCreate):
    pass


class RecipeOut(BaseModel):
    id: int
    title: str
    description: str
    servings_base: int
    servings_requested: int
    prep_time_minutes: int
    is_public: bool
    owner_id: int
    is_owner: bool
    ingredients: list[RecipeIngredientOut]

    model_config = {"from_attributes": True}


class RecipeSummaryOut(BaseModel):
    id: int
    title: str
    servings_base: int
    prep_time_minutes: int
    is_public: bool
    owner_id: int

    model_config = {"from_attributes": True}
