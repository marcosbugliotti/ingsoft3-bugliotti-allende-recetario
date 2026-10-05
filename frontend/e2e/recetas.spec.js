import { expect, test } from '@playwright/test'

// Registra un usuario con email único (por la UI, como lo haría una persona)
// y lo deja logueado en '/'. Devuelve el email por si algún test lo necesita.
async function registrarYLoguear(page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`
  await page.goto('/login')
  await page.getByRole('button', { name: 'Registrate' }).click()
  await page.getByLabel('Nombre').fill('E2E Test')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill('Test1234!')
  await page.getByRole('button', { name: 'Registrarme' }).click()
  await expect(page).toHaveURL('/')
  return email
}

// Completa el formulario de "Nueva receta" y guarda. No asume que el guardado
// vaya a salir bien (el test de título repetido lo usa justo para ESO).
async function crearReceta(page, { title, description = 'receta de e2e', servingsBase = '2', prepTime = '15', ingredient } = {}) {
  await page.getByRole('button', { name: '+ Nueva receta' }).click()
  await page.getByLabel('Título').fill(title)
  await page.getByLabel('Descripción').fill(description)
  await page.getByLabel('Porciones base').fill(servingsBase)
  await page.getByLabel('Tiempo de preparación (min)').fill(prepTime)
  if (ingredient) {
    await page.getByPlaceholder('Nombre').fill(ingredient.name)
    await page.getByPlaceholder('Unidad (g, u, ml...)').fill(ingredient.unit)
    await page.getByPlaceholder('Cantidad').fill(String(ingredient.quantity))
  }
  await page.getByRole('button', { name: 'Guardar' }).click()
}

async function buscar(page, texto) {
  await page.goto('/')
  await page.getByPlaceholder('Buscar por título o ingrediente...').fill(texto)
  await page.getByRole('button', { name: 'Buscar' }).click()
}

test('crear una receta la muestra en la lista, y borrarla la saca', async ({ page }) => {
  await registrarYLoguear(page)
  const titulo = `e2e ${Date.now()}` // único: no choca con otra corrida

  await crearReceta(page, {
    title: titulo,
    ingredient: { name: 'Azúcar', unit: 'g', quantity: 100 },
  })
  await expect(page).toHaveURL(/\/recipes\/\d+/) // al guardar, navega al detalle
  await expect(page.getByText(titulo)).toBeVisible() // el dato que ESTE test creó

  await buscar(page, titulo)
  await expect(page.getByText(titulo)).toBeVisible() // aparece en el listado

  await page.getByText(titulo).click() // reabrir el detalle desde la lista
  page.once('dialog', (dialog) => dialog.accept()) // el Borrar usa window.confirm
  await page.getByRole('button', { name: 'Borrar' }).click()
  await expect(page).toHaveURL('/')

  await buscar(page, titulo)
  await expect(page.getByText(titulo)).toHaveCount(0) // y el borrado, comprobado
})

test('un título repetido muestra el error y no crea una receta nueva', async ({ page }) => {
  await registrarYLoguear(page)
  const titulo = `e2e-dup ${Date.now()}`

  await crearReceta(page, { title: titulo })
  await expect(page).toHaveURL(/\/recipes\/\d+/)

  await page.getByRole('button', { name: '← Volver' }).click()
  await crearReceta(page, { title: titulo }) // mismo título: la api lo rechaza

  await expect(page.getByRole('alert')).toBeVisible() // el usuario ve el error…
  await expect(page.getByRole('alert')).toContainText('ese título')
  await expect(page).toHaveURL('/recipes/new') // …y no navegó: no se guardó nada

  await buscar(page, titulo)
  await expect(page.getByText(titulo)).toHaveCount(1) // solo existe LA PRIMERA

  await page.getByText(titulo).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Borrar' }).click() // limpieza
})

test('publicar una receta completa la hace pública', async ({ page }) => {
  await registrarYLoguear(page)
  const titulo = `e2e-pub ${Date.now()}`

  await crearReceta(page, {
    title: titulo,
    prepTime: '20',
    ingredient: { name: 'Sal', unit: 'g', quantity: 5 },
  })
  await expect(page.getByText('Privada')).toBeVisible() // nace privada

  await page.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByText('Pública')).toBeVisible() // y pasa a pública

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Borrar' }).click() // limpieza
  await expect(page).toHaveURL('/')
})
