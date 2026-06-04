import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** Impede que um erro em um componente derrube a aplicação inteira (tela branca). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary capturou:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 h-full gap-3 p-8 text-center">
          <span className="text-3xl">⚠️</span>
          <h2 className="text-sm font-semibold">Algo deu errado ao exibir esta tela</h2>
          <p className="text-xs text-gray-500 max-w-md break-words">{this.state.error.message}</p>
          <button
            onClick={() => {
              this.setState({ error: null })
              location.reload()
            }}
            className="btn-secondary text-xs"
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
