import LoginForm from './LoginForm'

type SearchParams = Promise<{ brand?: string }>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const brand = params.brand === 'cgt' ? 'cgt' : 'loveondev'
  return <LoginForm brand={brand} />
}
