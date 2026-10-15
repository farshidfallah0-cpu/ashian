import { LoginModal } from './login-modal';

type Props = { searchParams: Promise<{ next?: string }> };

export default async function InterceptedLogin({ searchParams }: Props) {
  const { next } = await searchParams;
  return <LoginModal next={next} />;
}